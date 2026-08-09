# Person Monitor — Report Model Coverage Matrix

Version: `coverage-v1-draft`

Цей документ описує, де зараз знаходяться дані кожної секції
Report Model та які шари ще не підключені.

## Позначення

- `READY_V1` — функція доступна користувачу у V1.
- `READY_DATA` — дані та backend є, але немає повного presentation layer.
- `READY_DATA_UI` — backend та частина UI є, але Report Model/export неповні.
- `PARTIAL` — реалізована лише частина ланцюга.
- `MISSING` — канонічної реалізації немає.
- `MISSING_PRESENTATION` — дані є, але немає продуктового представлення.

## Coverage Matrix

| Section | Статус | DB / source | Loader / service | API | UI | PDF | Excel | Chat | Основний gap |
|---|---|---|---|---|---|---|---|---|---|
| `report_meta`<br>Службова інформація | `PARTIAL` | subjects timestamps; source_documents timestamps/providers | частково через subject/source data | health; subject-stats; report endpoints | остання перевірка; stats | PARTIAL: generatedAt + базові subject дані | PARTIAL: generatedAt + базові subject дані | майже не використовується | Єдина metadata-модель; freshness кожного provider; report version; analyzed period |
| `identity`<br>Ідентифікація суб'єкта | `PARTIAL` | subjects; entities; entity_identifiers; facts; identity_observations | getSubject; entity-resolution | subjects; chat використовує subject | ПІБ, організація, посада, місто | PARTIAL: лише базовий subject | PARTIAL: лише базовий subject | subject profile deterministic path | GUID/aliases/status у dossier; candidate review UI; merge/reject workflow |
| `executive_summary`<br>Коротке аналітичне резюме | `MISSING` | може будуватись із facts/relations/cross_checks/analytics | немає canonical summary loader | немає | немає | немає | немає | AI може синтезувати ad hoc | Детермінований summary model + AI narrative поверх доказових findings |
| `declarations`<br>Хронологія декларацій | `PARTIAL` | facts: declaration_submission; source_documents | declaration deterministic context; chat knowledge | chat; джерела опосередковано | декларації переважно як mentions | PARTIAL: декларації як mention-group | PARTIAL: декларації як mention-sheet | READY_V1 | Timeline років; усі submission; canonical flag; окрема dossier section |
| `career`<br>Кар'єрний шлях | `PARTIAL` | facts: employment; relations: employed_by | employment context; analytics | chat; subject-graph | частково через graph | немає окремої секції | немає окремого sheet | READY_V1 factual | Career timeline; periods; transitions; related organizations/persons |
| `related_people`<br>Сім'я та пов'язані особи | `PARTIAL` | family_member facts; identity_observations; relations: family_member_observed/third_party_rightsholder | family context; graph/knowledge loaders | chat; subject-graph | частково graph | немає окремої секції | немає окремого sheet | READY_V1 для family | Third-party identity lifecycle; status; declaration discovery; review workflow |
| `income`<br>Доходи | `READY_DATA` | facts: income; relations: income_from; source_documents | single-year; multi-year; income-detail; analytics | chat | немає повної income section | немає структурованої income section | немає структурованого income sheet | READY_V1 | Підключити до Report Model, dossier, PDF та Excel |
| `cash_assets`<br>Грошові активи | `READY_DATA` | facts: cash_asset; source_documents | cash deterministic context; analytics | chat | немає повної cash section | немає структурованої секції | немає структурованого sheet | READY_V1 | Report Model section; currency grouping; year dynamics in UI/export |
| `real_estate_vehicles`<br>Нерухомість і транспорт | `PARTIAL` | facts: real_estate/vehicle; asset tracking; relations | real-estate context; vehicle context; analytics | chat; subject-graph | частково graph | немає structured asset section | немає structured asset sheets | READY_V1 | Dossier asset tables; acquisition/disposal state; external property source |
| `relations`<br>Зв'язки | `READY_DATA_UI` | relations; entities; identity_observations | subject graph; organization relations; chat knowledge | subject-graph; chat | READY_V1 graph | немає structured relations section | немає relations sheet | READY_V1 | Report representation; future career/buy/sell relation types; evidence display |
| `analytics`<br>Кросчекінг, метрики та сигнали | `PARTIAL` | cross_checks + underlying facts; частина analytics обчислюється runtime | buildEntityAnalytics; chat retrieval | переважно chat | немає analytics dashboard | немає findings section | немає metrics/findings sheets | PARTIAL | Rule registry; severity/confidence/evidence contract; metrics API/UI/export |
| `mentions`<br>Згадки та новини | `READY_V1` | mentions; source_documents | listMentions; chat retrieval для news intent | mentions/subject endpoints; report endpoints | READY_V1: list/search/provider/sort | READY_V1 mentions-oriented | READY_V1 mentions-oriented | PARTIAL: news intent | Event clustering; stronger identity confidence; dedup; news intelligence |
| `sources_methodology`<br>Джерела та методологія | `MISSING_PRESENTATION` | source_documents; fact/relation metadata; confidence/verification fields | дані доступні різним loaders | source tool у chat частково | немає єдиної section | немає methodology section | немає methodology/source registry sheet | source grounding PARTIAL | Canonical provenance model; source registry; methodology; statement type |

## Головні висновки

### 1. Основний розрив — не відсутність даних

Для income, cash, assets, relations та declarations значна частина
backend уже існує. Проблема полягає в тому, що ці дані не проходять
через одну канонічну Report Model до всіх presentation layers.

### 2. Поточні PDF та Excel є mentions-oriented

Наявні звіти переважно отримують `subject + mentions`.
Тому вони не є повним аналітичним досьє навіть тоді, коли
структуровані facts та analytics уже знаходяться у базі.

### 3. Chat має найбільше покриття структурованих даних

Chat уже має окремі deterministic loaders для значної частини
предметних областей. Report Model повинен повторно використовувати
ці правила отримання канонічних даних, а не створювати паралельну логіку.

### 4. UI зараз складається з незалежних блоків

Subjects, stats, mentions, graph і chat завантажуються окремо.
A2 повинен перетворити їх на єдине Subject Dossier.

## Пріоритет gaps для Етапу A

1. Побудувати canonical `buildSubjectReportModel(subjectId)`.
2. Не переписувати існуючі domain loaders без необхідності.
3. Створити Subject Dossier API на базі Report Model.
4. Перебудувати UI картки суб'єкта на sections Report Model.
5. Після цього перевести PDF та Excel з `subject + mentions` на Report Model.
6. Chat використовувати як окреме представлення того самого knowledge/report layer.

## A1 exit criteria

A1 можна закрити після того, як:

- `REPORT_MODEL_SPEC.md` затверджує структуру;
- ця coverage matrix документує поточні gaps;
- визначено наступний архітектурний компонент: `buildSubjectReportModel()`;
- production-код ще не змінюється до початку A2.

