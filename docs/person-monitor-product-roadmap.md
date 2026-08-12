# Person Monitor — функціональна модель, поточний стан і дорожня карта

**Дата фіксації:** 12.08.2026
**Базова точка:** блоки 5.4F1a–5.4F1c «Dossier version persistence» закрито; schema `dossier_versions` застосована в Neon, versioned canonical JSON SHA-256 hashing та insert-only dossier-version store готові, persistence stage підключений до orchestrator і production `/api/dossier`, live Neon persistence перевірено контрольованим snapshot. Блоки 5.4F2a–5.4F2e «Manual Review Queue workflow» завершено. Core evidence/provenance presentation E1–E3 також завершено: authenticated persisted-snapshot read API підтримує latest snapshot за `subjectId` та exact snapshot за `dossierVersionId`; portal показує canonical source catalog, `executive_summary` finding → evidence → canonical source та дозволяє переходити з Manual Review task до exact `latest_dossier_version_id` без автоматичної генерації нового dossier. Final canonical dossier presentation G1–G7 завершена: shell, career/relations, finances, assets, analytics/transitions/signals, media mentions, evidence/source catalog і canonical methodology відображаються з persisted `report_payload` без створення паралельної presentation-моделі.
**Технічний стан:** повний regression suite GREEN. `dossier_versions` зберігає canonical dossier snapshots та integrity metadata. `report_id` у `report-model-v1` лишається reserved nullable field, а persisted snapshot identity є `dossier_versions.id`. Для Human Manual Review існують stable logical tasks і per-snapshot occurrences. F2b `syncManualReviewTasks()` приймає лише canonical reference-only `manual-review-manifest-v1`, перевіряє `dossier_version_id → subject_id`, dedupe-ить manifest items та atomic CTE statement синхронізує tasks/occurrences без автоматичного reopen `resolved / dismissed`. F2c додає окремий `review_queue` stage після успішного dossier persistence. F2d додає authenticated `/api/manual-review`: `GET` списує reference-only queue tasks із фільтрами, `PATCH` виконує explicit analyst transition `open / resolved / dismissed`, включно з ручним reopen, і явно оновлює `updated_at`. Unsupported methods відхиляються до auth, validation повертає 400, missing task — 404, internal failures не розкривають DB details. F2e додає portal auth shell, Manual Review Queue UI, subject/status filters та explicit analyst actions. ПІБ у queue UI є лише presentation join із `/api/subjects` і не зберігається у queue persistence. Media `review_status`, ПІБ, facts, evidence, URL та article text у human queue не потрапляють. Core evidence/provenance E1–E3 та final dossier presentation G1–G7 завершено. Raw internal source IDs прибрані з presentation, canonical source/evidence joins лишаються внутрішніми, а methodology projection читається з persisted `report_payload`. Далі — явна authenticated analyst action `Сформувати / Оновити досьє`, потім canonical exports та audit/diff.

## 1. Що повинен вміти портал

Person Monitor має бути не просто пошуковим сайтом, а системою автоматичного формування аналітичного досьє на суб’єкта декларування.

Цільовий сценарій: **ідентифікація суб’єкта → збір джерел → нормалізація → зв’язки → порівняння років → аномалії та cross-checks → граф і метрики → доказове пояснення → аналітична довідка → AI-чат → PDF/Excel/Drive → подальший моніторинг змін.**

Логічні шари: **збір даних → ідентифікація → нормалізація та зв’язки → аналітика → представлення → експорт і моніторинг.**

## 2. Що портал уміє зараз

- Ідентифікація за ПІБ, GUID, посадою та додатковим контекстом із рівнями `confirmed / probable / possible / rejected`.
- Структуроване витягування з декларацій: доходи, готівка, нерухомість, транспорт, члени сім’ї, треті особи, права, місце роботи.
- Canonical report model для декларацій, доходів, активів, career, family, relations, mentions і source documents.
- AI-чат із контекстом суб’єкта, історією діалогу та deterministic-відповідями по ключових доменах.
- Граф зв’язків: робота, активи, доходи, сім’я, сторонні правовласники, identity resolution, ЄДР-зв’язки.
- Повний технічний pipeline ЄДР/ФОП: discovery → download → parser → normalization → staging → Neon → lookup → matching → graph → weekly check → snapshot diff.
- Порівняння активів між роками та консервативні події “з’явився/вибув”, без вигаданого висновку “купив/продав”.
- Розумний Google Web/Google News: corruption-only query plan, corruption relevance gate, identity gate, full-text fetch/extraction/review.
- Versioned dossier persistence у Neon уже працює; persisted snapshot identity — `dossier_versions.id`.
- Manual Review Queue F2a–F2e готова: stable logical tasks + snapshot occurrences у Neon, atomic reference-only store/sync, orchestrator/API production wiring, authenticated analyst status API та portal analyst UI.
- Persisted dossier read/evidence flow готовий: latest/exact snapshot read API, canonical source catalog, evidence-backed executive-summary presentation та exact snapshot navigation із Manual Review Queue.
- Final canonical dossier presentation G1–G7 готова: overview, key findings, career/relations, finances, assets, analytics/transitions/signals, media mentions, evidence/source catalog та methodology відображаються з persisted canonical `report_payload`.
- Presentation не показує raw `source_document_id` або `source_item_ref`; вони лишаються internal references для evidence/source resolution. Snapshot version та SHA-256 збережені як audit/integrity metadata.
- PDF та Excel експорти вже існують, але поки відображають legacy-звіт згадок, а не повну нову аналітичну довідку.

### 2.1. Final dossier presentation G1–G7

- **G1** — canonical dossier presentation shell (`b1c485b`).
- **G2** — career, related people та relations presentation (`8d33c54`).
- **G3 + G4** — finances та assets presentation у спільному commit (`2880814`).
- **G5** — analytics, transitions та analytical signals presentation (`5beb267`).
- **G6** — canonical media mentions presentation (`3e62e4b`).
- **G7** — evidence/source catalog + canonical methodology presentation (`eb15506`) та repair (`1187459`).
- Усі секції є projection із persisted canonical `report_payload`; окремої persisted UI-моделі немає.
- Відкриття subject або exact snapshot залишається read-only; dossier generation не запускається автоматично.

## 3. Стан 24 функцій зі списку

| № | Функція | Стан | Що залишилось |
|---:|---|---|---|
| 1 | Чат із контекстом | ✅ Готово | Ядро працює; надалі — підключати нові джерела до knowledge layer та полірувати UI. |
| 2 | Відмальовка шаблону на основі даних | ✅ Готово | Final canonical dossier presentation G1–G7 працює поверх persisted `report_payload`; наступні зміни тут уже є UI polish, а не відсутній базовий шаблон. |
| 3 | Експорт PDF | 🟡 Частково | PDF працює, але це legacy-звіт згадок. Перевести на повну аналітичну довідку. |
| 4 | Експорт Excel | 🟡 Частково | Excel працює, але його теж треба перевести на canonical report model. |
| 5 | Підключення AUTO.RIA | ⬜ Не реалізовано | Source adapter, нормалізація, matching, оцінка вартості/оголошень. |
| 6 | Джерело по нерухомості | ⬜ Не реалізовано | Обрати доступне джерело/API і підключити через source adapter. |
| 7 | OpenDataBot | ⬜ Не реалізовано | Спершу визначити унікальну цінність поверх ЄДР/НАЗК/судів; потім adapter. |
| 8 | Графове відображення зв’язків | 🟡 Майже готово | API та UI є; додавати нові типи зв’язків і джерела. |
| 9 | Ідентифікація по ПІБ | ✅ Готово | Працює scoring та рівні confirmed/probable/possible/rejected. |
| 10 | Ідентифікація по посаді | ✅ Готово | Посада використовується як незалежний контекст ідентифікації. |
| 11 | Ідентифікація по GUID | ✅ Готово | GUID — hard match із конфліктною логікою. |
| 12 | Кросчекінг | 🟡 Частково | Є окремі правила; потрібна повна матриця cross-checks та єдина шкала сигналів. |
| 13 | Реєстр корупціонерів | 🟡 Частково | Пошук уже є через corruptinfo.nazk.gov.ua; потрібна пряма/стійкіша інтеграція і окремий блок довідки. |
| 14 | Кастомні фільтри | ⬜/🟡 Частково | Є базові фільтри; потрібен повноцінний конструктор фільтрації досьє/графа/згадок. |
| 15 | Відмалювати FSM | ⬜ Не реалізовано | Спочатку зафіксувати, що саме FSM означає в продукті та яку користь дає аналітику. |
| 16 | Збереження файлів у Google Drive | ⬜ Не реалізовано | Upload PDF/Excel, URL, version metadata, повторне збереження нових версій. |
| 17 | Зв’язки по кар’єрному шляху | 🟡 Частково | Employment/career вже є; потрібна повна timeline і глибша інтеграція з графом. |
| 18 | Зв’язки по купівлі/продажу | ✅* Реалізовано консервативно | Правильніше: зміни активів / потенційні транзакційні події. Поява/вибуття ≠ автоматично купівля/продаж. |
| 19 | Декларації третіх осіб | 🟡 Частково | Треті особи вже витягуються; автоматичний пошук їх декларацій ще потрібен. |
| 20 | Пул новин пов’язаних із суб’єктом | 🟡 Сильно просунуто | Google Web/News, corruption gate, identity gate, full-text verification, класифікація ролі та canonical media presentation у досьє готові. Подальше розширення джерел — після explicit build/update action та audit/diff. |
| 21 | Формування метрик | 🟡 Частково | Analytics/metrics/findings є; затвердити фінальний набір і шкалу ризиків/сигналів. |
| 22 | Структура на кроки + аналітична довідка | 🟡 Майже готово | Canonical model, `analytical_brief` manifest, final G1–G7 presentation, evidence/methodology, versioned persistence і Manual Review workflow готові. Наступний ключовий крок — explicit analyst build/update action; після нього canonical exports та audit/diff. |
| 23 | Математичні правила порівняння | 🟡 Частково | Частина правил є; потрібна формалізована rule matrix для всіх ключових типів даних. |
| 24 | Зробити PDF | 🔁 Дублікат | Об’єднати з пунктом №3. |

## 4. Що варто змінити у списку

- **Пункт 24 видалити або об’єднати з №3** — це дублікат PDF.
- **Пункт 18 перейменувати** на «Зміни активів та потенційні транзакційні події». Це точніше: зникнення активу з декларації саме по собі не доводить продаж.
- **OpenDataBot не робити критичною залежністю**, доки не перевірено, які унікальні дані він дає понад ЄДР/НАЗК/суди.
- **AUTO.RIA використовувати як допоміжне джерело** ринкової вартості, характеристик та історії оголошень, а не як джерело істини про право власності.

## 5. Функції, яких бракує у Trello

1. **ЄДР / ФОП.** Винести вже реалізований pipeline у окрему картку backlog та вирішити production storage для повного масиву.
2. **Orchestrator «Сформувати досьє».** Одна дія має запускати весь pipeline: джерела → ідентифікація → факти → зв’язки → cross-checks → метрики → довідка → експорт.
3. **Evidence / provenance UI.** Core E1–E3 і G7 завершено: persisted latest/exact snapshot read, canonical source catalog, `finding → evidence → canonical source`, statement-type labels, methodology projection та Manual Review → exact snapshot navigation готові. Provider full article text не показувати; raw internal source IDs не виводити у presentation.
4. **Manual Review Queue.** F2a schema foundation, F2b store/sync contract, F2c orchestrator wiring, F2d analyst status API і F2e analyst UI завершені. Stable logical task зберігається окремо від per-snapshot occurrence; sync перевіряє subject/version consistency, працює idempotent і не reopen-ить `resolved / dismissed`. Orchestrator запускає queue sync лише після успішного dossier persistence та повертає `partial`, не втрачаючи persisted snapshot, якщо review sync падає. Authenticated `GET /api/manual-review` списує queue, `PATCH /api/manual-review` дозволяє явні analyst transitions `open / resolved / dismissed`, а portal UI підтримує login/session/logout, filters та analyst actions. Probable/ambiguous/conflict кейси мають потрапляти сюди тільки через canonical human-review semantics; media `review_status` не є human queue.
5. **Версії досьє та audit trail.** `dossier_versions`, canonical payload hash, insert-only store, production orchestrator wiring, live Neon snapshot verification та authenticated latest/exact snapshot read уже реалізовані. Manual Review UI використовує `dossier_versions.id` для exact snapshot navigation. Далі — version history, run/source metadata та порівняння змін між версіями; `report_id` у `report-model-v1` лишається reserved nullable field.
6. **Моніторинг змін.** Нові декларації, зміни ЄДР, нові релевантні медіаматеріали, зміни зв’язків/активів.
7. **Статус джерел.** Показувати окремо успіх/помилку/timeout/недоступність кожного джерела, щоб “нічого не знайдено” не плуталось з “джерело не перевірено”.
8. **Роль суб’єкта в корупційних матеріалах.** Розрізняти adverse_context / anti_corruption_activity / related_mention без висновку про винуватість.

## 6. Рекомендована структура backlog

- **I. Суб’єкт та ідентифікація.** ПІБ, посада, GUID, aliases, ручна перевірка неоднозначних кандидатів.
- **II. Джерела.** НАЗК, ЄДР/ФОП, суди, Prozorro, Реєстр корупціонерів, Google/News, AUTO.RIA, нерухомість, OpenDataBot.
- **III. Нормалізація та зв’язки.** Єдина модель даних, career, family, third parties, активи, компанії, graph.
- **IV. Аналітика.** Cross-checking, математичні правила, метрики, класифікація ролі у медіа, сигнали та findings.
- **V. Аналітичне досьє.** Фінальна структура довідки, UI, фільтри, FSM/візуалізації, evidence.
- **VI. AI.** Контекстний чат по конкретному суб’єкту з grounded-відповідями.
- **VII. Видача та моніторинг.** PDF, Excel, Google Drive, версії досьє, повторний моніторинг і журнал змін.

## 7. Пріоритет після паузи

Не підключати нові великі джерела одразу. Core evidence/provenance E1–E3 та final dossier presentation G1–G7 уже завершено. Поточна оптимальна послідовність: **явна authenticated analyst action `Сформувати / Оновити досьє` → canonical PDF/Excel → audit/diff → після цього AUTO.RIA / нерухомість / OpenDataBot.**

Причина: технічних “двигунів” уже багато. Найбільша потреба зараз — зібрати їх в один завершений користувацький сценарій, щоб кожне наступне джерело автоматично потрапляло у граф, аналітику, чат, довідку, PDF та Excel.

## 8. Орієнтовна оцінка готовності

- **Backend / аналітичний фундамент:** приблизно 65–75%.
- **Завершений кінцевий продукт для аналітика:** приблизно 45–55%.

Це не метрика виконаних рядків коду, а робоча оцінка зрілості системи: значна частина ядра вже є, але потрібна інтеграція модулів у єдиний workflow та фінальний продукт.
