# Person Monitor

Person Monitor — система для автоматизованого формування аналітичного досьє на суб’єкта декларування.

Поточний продукт виріс із локального Telegram-бота для моніторингу згадок і тепер включає canonical report model, ідентифікацію, деклараційні дані, ЄДР/ФОП, граф зв’язків, аналітику, evidence/provenance, AI-чат, versioned dossier persistence, Manual Review Queue та analyst evidence/provenance UI.

## Поточний pipeline

**Ідентифікація → збір джерел → нормалізація → зв’язки → порівняння років → cross-checks / сигнали → граф і метрики → evidence → аналітичне досьє → AI-чат → PDF / Excel → подальший моніторинг.**

## Що вже реалізовано

- ідентифікація суб’єкта за ПІБ, GUID, посадою, організацією, містом та додатковим контекстом;
- рівні identity match: `confirmed / probable / possible / rejected`;
- GUID як hard identity evidence; ПІБ сам по собі не є hard confirmation;
- структуроване витягування декларацій НАЗК:
  - доходи;
  - готівка;
  - нерухомість;
  - транспорт;
  - члени сім’ї;
  - треті особи;
  - права власності;
  - місце роботи;
  - джерела доходів;
- canonical `report-model-v1`;
- deterministic analytics, findings та evidence-backed executive summary;
- `analytical_brief` як стабільний presentation manifest;
- unified dossier orchestrator;
- authenticated `POST /api/dossier?subjectId=...`;
- authenticated read-only `GET /api/dossier-version` для latest snapshot за `subjectId` або exact snapshot за `dossierVersionId`;
- versioned dossier persistence у Neon через `dossier_versions`;
- canonical JSON SHA-256 integrity hashing;
- контрольована live Neon persistence verification;
- reference-only canonical `manual_review` manifest;
- Manual Review Queue F2a–F2e workflow + analyst UI:
  - `manual_review_tasks`;
  - `manual_review_task_occurrences`;
  - atomic reference-only store/sync contract;
  - idempotent snapshot occurrences без автоматичного reopen `resolved / dismissed`;
  - orchestrator wiring після успішного dossier persistence;
  - production `/api/dossier` підключає dossier persistence та manual-review sync;
  - authenticated `/api/manual-review` для list/filter та explicit analyst status update;
  - analyst auth shell через `/api/session`, `/api/login`, `/api/logout`;
  - Manual Review Queue UI з status/subject filters;
  - analyst actions `resolved / dismissed / reopen` через authenticated PATCH;
  - перехід із Manual Review task до exact persisted snapshot через `latest_dossier_version_id`;
- persisted dossier evidence/provenance UI:
  - latest persisted snapshot переглядається за subject без створення нової версії;
  - exact persisted snapshot переглядається за `dossierVersionId`;
  - `executive_summary` signals показуються як `finding → evidence → canonical source`;
  - UI розрізняє `source_fact`, `calculation` та `heuristic_signal`;
  - canonical source catalog показує лише безпечні source metadata та URL, без provider full article text;
  - вибір subject, відкриття review task та refresh перегляду не викликають автоматичний `POST /api/dossier`;
- повний технічний pipeline ЄДР/ФОП:
  discovery → download → parser → normalization → staging → Neon → lookup → matching → graph → weekly check → snapshot diff;
- timeless EDR relations у canonical report;
- граф зв’язків для роботи, сім’ї, third parties, активів, доходів та організацій;
- консервативне відстеження змін активів між роками без автоматичного висновку «купив / продав»;
- Google Web / Google News corruption-only pipeline:
  - corruption relevance gate;
  - identity gate;
  - full-text fetch/extraction;
  - локальний identity context;
  - класифікація ролі суб’єкта;
- AI-чат із контекстом конкретного суб’єкта та deterministic-відповідями для ключових доменів;
- Telegram workflow;
- PDF та Excel legacy exports;
- судовий open-data index.

## Ключові архітектурні контракти

### Canonical report

Основний builder — `src/report-model.js`.

Canonical payload містить, зокрема:

```text
subject
identity
executive_summary
analytical_brief
manual_review
declarations
career
related_people
income
cash_assets
real_estate
vehicles
relations
analytics
mentions
sources
methodology
```

`meta.report_id` у `report-model-v1` є reserved nullable compatibility field і наразі залишається `null`.

Persisted dossier snapshot identity — це `dossier_versions.id`. Persistence не backfill-ить storage ID у canonical payload.

### Manual Review

Canonical `manual_review` є reference-only manifest.

Human-review queue не повинна копіювати ПІБ, факти, evidence, URL або article text.

Automated media `review_status` — окрема семантика і не є Human Manual Review Queue.

F2a schema foundation, F2b store/sync contract, F2c orchestrator wiring, F2d analyst review status API і F2e Manual Review Queue UI завершені.

Після успішного збереження `dossier_versions` orchestrator передає `dossier_version.id` та canonical `report.manual_review` у queue sync. Якщо dossier persistence не відбувся, queue sync пропускається. Помилка queue sync не видаляє canonical report або вже persisted dossier snapshot, але workflow повертається як `partial`.

`GET /api/manual-review` повертає reference-only tasks із фільтрами subject/status/limit. `PATCH /api/manual-review` дозволяє analyst явно встановити `open`, `resolved` або `dismissed`; explicit reopen дозволений, але автоматичний sync resolved/dismissed tasks не reopen-ить.

Frontend тепер має analyst auth shell, read-only queue з status/subject filters та явні actions `resolved / dismissed / reopen`. ПІБ використовується лише як UI-join із `/api/subjects` і не копіюється у Human Manual Review persistence. Після status mutation queue перечитується з API, тому UI не підміняє occurrence metadata неповною PATCH-відповіддю. Review task може відкрити саме `latest_dossier_version_id`, а подальший refresh зберігає exact-version semantics.

Наступні блоки:

1. фінальна dossier presentation та safe source-context presentation;
2. явна analyst action `Сформувати / Оновити досьє`;
3. canonical PDF/Excel та audit/diff.

## Джерела

Поточна система працює або має adapters/pipeline для:

- декларацій НАЗК;
- Реєстру корупціонерів НАЗК;
- ЄДР / ФОП;
- Google Web;
- Google News;
- офіційних сайтів;
- Prozorro;
- Судової влади України / court open data;
- судового web fallback.

AUTO.RIA, окреме джерело нерухомості та OpenDataBot поки не є частиною основного production dossier pipeline.

## Запуск

### Вимоги

- Node.js 22+;
- npm;
- для частини court tooling — Python 3;
- `.env` із потрібними ключами та DB configuration.

Встановлення:

```bash
npm install
```

Запуск Telegram-процесу:

```bash
npm start
```

## Тести

Повний test suite:

```bash
npm test
```

Поточний повний regression suite: **GREEN**.

## Database migrations

Dossier version persistence:

```bash
npm run db:migrate:dossier
npm run db:verify:dossier
```

Manual Review Queue foundation:

```bash
npm run db:migrate:manual-review
npm run db:verify:manual-review
```

## Документація

Основна продуктова дорожня карта:

```text
docs/person-monitor-product-roadmap.md
```

Canonical report contracts:

```text
docs/REPORT_MODEL_SCHEMA.md
docs/REPORT_MODEL_SPEC.md
```

## Важливі обмеження

- full EDR import у поточний Neon production storage не запускається до окремого рішення щодо capacity; поточний logical limit — 512 MiB;
- поява або зникнення активу з декларації не означає автоматично купівлю або продаж;
- збіг особи є результатом identity-resolution policy, а не юридичним встановленням особи;
- fetch failure не означає identity mismatch;
- search query text не є identity evidence;
- provider output не повинен віддавати користувачу повний текст статті;
- PDF та Excel поки залишаються legacy exports і ще не переведені повністю на canonical analytical dossier;
- Manual Review Queue має schema foundation, atomic store/sync contract, orchestrator wiring, authenticated analyst status API та analyst UI; actor/note/history audit trail ще не реалізовано;
- AUTO.RIA / нерухомість / OpenDataBot не повинні випереджати завершення dossier, evidence та review workflow.
