import {
  Readable,
} from "node:stream";

import {
  StringDecoder,
} from "node:string_decoder";

import sax from "sax";

function localName(
  value,
) {
  const name =
    String(value ?? "");

  const separator =
    name.lastIndexOf(":");

  return (
    separator >= 0
      ? name.slice(
          separator + 1,
        )
      : name
  ).toUpperCase();
}

function normalizeAttributes(
  attributes = {},
) {
  const result = {};

  for (
    const [
      key,
      value,
    ] of Object.entries(
      attributes,
    )
  ) {
    const normalizedValue =
      value &&
      typeof value === "object" &&
      "value" in value
        ? value.value
        : value;

    result[
      localName(key)
    ] =
      String(
        normalizedValue ?? "",
      );
  }

  return result;
}

function appendValue(
  target,
  key,
  value,
) {
  if (
    !Object.hasOwn(
      target,
      key,
    )
  ) {
    target[key] =
      value;

    return;
  }

  if (
    Array.isArray(
      target[key],
    )
  ) {
    target[key].push(
      value,
    );

    return;
  }

  target[key] = [
    target[key],
    value,
  ];
}

function elementToValue(
  element,
) {
  const text =
    element.text.trim();

  const attributeNames =
    Object.keys(
      element.attributes,
    );

  if (
    element.children.length === 0 &&
    attributeNames.length === 0
  ) {
    return text;
  }

  const result = {};

  if (
    attributeNames.length > 0
  ) {
    result._attributes = {
      ...element.attributes,
    };
  }

  for (
    const child of
      element.children
  ) {
    appendValue(
      result,
      child.name,
      elementToValue(
        child,
      ),
    );
  }

  if (text) {
    result._text =
      text;
  }

  return result;
}

function createElement(
  node,
) {
  return {
    name:
      localName(
        node.name,
      ),

    attributes:
      normalizeAttributes(
        node.attributes,
      ),

    text: "",

    children: [],
  };
}

function toAsyncIterable(
  input,
) {
  if (
    typeof input === "string" ||
    Buffer.isBuffer(input) ||
    ArrayBuffer.isView(input)
  ) {
    return Readable.from([
      input,
    ]);
  }

  if (
    input &&
    typeof input[
      Symbol.asyncIterator
    ] === "function"
  ) {
    return input;
  }

  throw new TypeError(
    "EDR XML input must be a string, Buffer, or async iterable",
  );
}

export async function*
parseEdrSubjectXmlStream(
  input,
  {
    requireSubject = false,
  } = {},
) {
  const source =
    toAsyncIterable(
      input,
    );

  const decoder =
    new StringDecoder(
      "utf8",
    );

  const parser =
    sax.parser(
      true,
      {
        trim: false,
        normalize: false,
        xmlns: false,
      },
    );

  let subjectStack =
    null;

  let pending =
    [];

  let subjectCount =
    0;

  function appendText(
    text,
  ) {
    if (
      !subjectStack ||
      subjectStack.length === 0
    ) {
      return;
    }

    subjectStack[
      subjectStack.length - 1
    ].text += text;
  }

  parser.onopentag =
    (node) => {
      const element =
        createElement(
          node,
        );

      if (
        element.name ===
        "SUBJECT"
      ) {
        if (subjectStack) {
          throw new Error(
            "Nested SUBJECT element is not supported",
          );
        }

        subjectStack = [
          element,
        ];

        return;
      }

      if (!subjectStack) {
        return;
      }

      const parent =
        subjectStack[
          subjectStack.length - 1
        ];

      parent.children.push(
        element,
      );

      subjectStack.push(
        element,
      );
    };

  parser.ontext =
    appendText;

  parser.oncdata =
    appendText;

  parser.onclosetag =
    (tagName) => {
      if (!subjectStack) {
        return;
      }

      const expectedName =
        localName(
          tagName,
        );

      const element =
        subjectStack.pop();

      if (
        !element ||
        element.name !==
          expectedName
      ) {
        throw new Error(
          "Unexpected EDR XML closing tag: " +
          expectedName,
        );
      }

      if (
        element.name !==
        "SUBJECT"
      ) {
        return;
      }

      if (
        subjectStack.length !==
        0
      ) {
        throw new Error(
          "Invalid SUBJECT nesting",
        );
      }

      pending.push(
        elementToValue(
          element,
        ),
      );

      subjectCount += 1;

      subjectStack =
        null;
    };

  parser.onerror =
    (error) => {
      throw error;
    };

  for await (
    const chunk of source
  ) {
    if (
      typeof chunk ===
      "string"
    ) {
      parser.write(
        chunk,
      );
    } else {
      const text =
        decoder.write(
          Buffer.isBuffer(
            chunk,
          )
            ? chunk
            : Buffer.from(
                chunk,
              ),
        );

      if (text) {
        parser.write(
          text,
        );
      }
    }

    while (
      pending.length > 0
    ) {
      yield pending.shift();
    }
  }

  const tail =
    decoder.end();

  if (tail) {
    parser.write(
      tail,
    );
  }

  parser.close();

  while (
    pending.length > 0
  ) {
    yield pending.shift();
  }

  if (subjectStack) {
    throw new Error(
      "EDR XML ended inside SUBJECT",
    );
  }

  if (
    requireSubject &&
    subjectCount === 0
  ) {
    throw new Error(
      "EDR XML contains no SUBJECT element",
    );
  }
}

export async function
parseSingleEdrSubjectXml(
  input,
) {
  let result =
    null;

  let count =
    0;

  for await (
    const subject of
      parseEdrSubjectXmlStream(
        input,
        {
          requireSubject: true,
        },
      )
  ) {
    count += 1;

    if (count > 1) {
      throw new Error(
        "EDR XML contains more than one SUBJECT",
      );
    }

    result =
      subject;
  }

  return result;
}
