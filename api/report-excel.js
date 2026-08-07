import { getSubject, listMentions } from "../src/store.js";
import { buildExcelReport } from "../src/reports.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function publicMentionUrl(mention) {
  if (mention.provider !== "nazk-declarations") {
    return mention;
  }

  return {
    ...mention,
    url: mention.url.replace(
      "https://public-api.nazk.gov.ua/v2/documents/",
      "https://public.nazk.gov.ua/documents/"
    ),
  };
}

export default async function handler(request, response) {
  try {
    const subjectId = String(request.query?.subjectId ?? "").trim();

    if (!UUID_RE.test(subjectId)) {
      return response.status(400).json({
        ok: false,
        error: "Invalid subjectId",
      });
    }

    const subject = await getSubject(subjectId);

    if (!subject) {
      return response.status(404).json({
        ok: false,
        error: "Subject not found",
      });
    }

    const mentions = (await listMentions(subjectId, 10000))
      .map(publicMentionUrl);

    const report = await buildExcelReport({
      subject,
      mentions,
      scanned: subject.last_scanned_count ?? 0,
      errors: [],
    });

    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    response.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(report.filename)}`
    );

    response.setHeader(
      "Cache-Control",
      "no-store"
    );

    return response.status(200).send(report.buffer);
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      ok: false,
      error: "Failed to build Excel report",
    });
  }
}
