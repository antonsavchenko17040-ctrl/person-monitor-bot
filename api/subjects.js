import { listSubjects } from "../src/store.js";

export default async function handler(request, response) {
  try {
    const subjects = await listSubjects();

    return response.status(200).json({
      ok: true,
      subjects: subjects.map((subject) => ({
        id: subject.id,
        full_name: subject.full_name,
        organization: subject.organization,
        position: subject.position,
        city: subject.city,
        aliases: subject.aliases ?? [],
        match_threshold: subject.match_threshold,
        enabled: subject.enabled,
        last_checked_at: subject.last_checked_at,
        last_scanned_count: subject.last_scanned_count ?? null,
      })),
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      ok: false,
      error: "Failed to load subjects",
    });
  }
}
