import test from "node:test";
import assert from "node:assert/strict";

import {
  ARTICLE_TEXT_VERSION,
  ARTICLE_TEXT_LIMITS,
  extractArticleText,
} from "../src/article-text.js";

test(
  "exports article text version and limits",
  () => {
    assert.equal(
      ARTICLE_TEXT_VERSION,
      "article-text-v1",
    );

    assert.equal(
      ARTICLE_TEXT_LIMITS
        .maxInputChars,
      1_000_000,
    );
  },
);

test(
  "prefers article content over surrounding page",
  () => {
    const output =
      extractArticleText(`
        <html>
          <body>
            <div>Сторонній текст</div>
            <article>
              <h1>Заголовок</h1>
              <p>Основний текст статті.</p>
            </article>
            <div>Інша реклама</div>
          </body>
        </html>
      `);

    assert.match(
      output.text,
      /Основний текст статті/,
    );

    assert.doesNotMatch(
      output.text,
      /Сторонній текст/,
    );
  },
);

test(
  "uses main when article is absent",
  () => {
    const output =
      extractArticleText(`
        <body>
          <main>
            <p>Текст із main.</p>
          </main>
        </body>
      `);

    assert.match(
      output.text,
      /Текст із main/,
    );
  },
);

test(
  "falls back to body",
  () => {
    const output =
      extractArticleText(`
        <html>
          <body>
            <p>Текст сторінки.</p>
          </body>
        </html>
      `);

    assert.match(
      output.text,
      /Текст сторінки/,
    );
  },
);

test(
  "removes scripts styles navigation and footer",
  () => {
    const output =
      extractArticleText(`
        <body>
          <nav>Меню сайту</nav>
          <script>dangerous()</script>
          <style>.hidden { display:none }</style>

          <article>
            <p>Корисний текст.</p>
          </article>

          <footer>Контакти редакції</footer>
        </body>
      `);

    assert.equal(
      output.text,
      "Корисний текст.",
    );
  },
);

test(
  "decodes common and numeric HTML entities",
  () => {
    const output =
      extractArticleText(`
        <article>
          <p>НАБУ &amp; САП &#8212; справа&nbsp;посадовця.</p>
        </article>
      `);

    assert.match(
      output.text,
      /НАБУ & САП — справа посадовця/,
    );
  },
);

test(
  "enforces input size limit",
  () => {
    const output =
      extractArticleText(
        "<body>" +
        "A".repeat(1000) +
        "</body>",
        {
          maxInputChars: 100,
          maxOutputChars: 1000,
        },
      );

    assert.equal(
      output.stats
        .input_truncated,
      true,
    );

    assert.equal(
      output.stats
        .processed_input_chars,
      100,
    );
  },
);

test(
  "enforces output size limit",
  () => {
    const output =
      extractArticleText(
        "<article>" +
        "Т".repeat(500) +
        "</article>",
        {
          maxOutputChars: 50,
        },
      );

    assert.equal(
      output.text.length,
      50,
    );

    assert.equal(
      output.stats
        .output_truncated,
      true,
    );
  },
);

test(
  "returns stable empty result for empty input",
  () => {
    const output =
      extractArticleText("");

    assert.equal(
      output.text,
      "",
    );

    assert.equal(
      output.stats.output_chars,
      0,
    );
  },
);
