# Person Monitor — Report Model Specification

Version: `report-model-v1-draft`

## 1. Мета

Report Model є єдиною канонічною моделлю аналітичного досьє суб'єкта.

Усі представлення повинні будуватися з однієї моделі:

`normalized data -> analytics/rules -> Report Model -> UI / Chat / PDF / Excel`

PDF, Excel, UI та Chat не повинні незалежно визначати зміст досьє.

## 2. Типи тверджень

Кожен елемент Report Model повинен мати семантичний тип:

- `source_fact` — факт безпосередньо з джерела;
- `identity_resolution` — результат зіставлення особи/сутності;
- `calculation` — математично обчислений показник;
- `heuristic_signal` — автоматичний сигнал або правило;
- `ai_analysis` — інтерпретація AI на основі переданого контексту.

AI-висновок ніколи не повинен маскуватися під підтверджений source_fact.

## 3. Базові принципи

- Не об'єднувати осіб лише за однаковим ПІБ.
- GUID документа декларації не є автоматично GUID особи.
- Різні валюти не сумуються без явно визначеного правила конвертації.
- Канонічна декларація визначається детерміновано.
- Кожен висновок повинен мати evidence/provenance.
- Невизначені identity matches повинні залишатися reviewable.
- Відсутність даних не означає відсутність факту в реальному світі.

## 4. Канонічні секції

### 4.1. Службова інформація

- Key: `report_meta`
- Status: `PARTIAL`
- Target: Дата формування, період аналізу, версія звіту, актуальність джерел
- Current gap: Є окремі timestamps у даних, але немає єдиної metadata-моделі звіту

### 4.2. Ідентифікація суб'єкта

- Key: `identity`
- Status: `PARTIAL`
- Target: ПІБ, посада, організація, місто, GUID/ідентифікатори, aliases, статус ідентифікації
- Current gap: Resolver існує, але немає завершеної секції досьє та review workflow

### 4.3. Коротке аналітичне резюме

- Key: `executive_summary`
- Status: `MISSING`
- Target: Ключові зміни, сигнали, ризики та висновки
- Current gap: Немає окремої універсальної summary-моделі

### 4.4. Хронологія декларацій

- Key: `declarations`
- Status: `PARTIAL`
- Target: Роки, усі подання, канонічна декларація, посилання на джерело
- Current gap: Дані та deterministic-відповіді є, але немає єдиної report-секції

### 4.5. Кар'єрний шлях

- Key: `career`
- Status: `PARTIAL`
- Target: Організації, посади, періоди та переходи
- Current gap: Employment facts і career change detection є; timeline ще не сформований

### 4.6. Сім'я та пов'язані особи

- Key: `related_people`
- Status: `PARTIAL`
- Target: Члени сім'ї, треті особи, правовласники, identity status
- Current gap: Facts і relations є, але немає повного lifecycle третьої особи

### 4.7. Доходи

- Key: `income`
- Status: `READY_V1`
- Target: Декларант, сім'я, домогосподарство, джерела доходу, динаміка
- Current gap: Основний deterministic та analytics engine уже працює

### 4.8. Грошові активи

- Key: `cash`
- Status: `READY_V1`
- Target: Активи по роках і валютах, власники та динаміка
- Current gap: Парсинг і deterministic-відповіді працюють

### 4.9. Нерухомість і транспорт

- Key: `assets`
- Status: `PARTIAL`
- Target: Об'єкти, права, власники, поява/вибуття активів
- Current gap: Дані НАЗК та asset tracking є; зовнішнього cross-check джерела ще немає

### 4.10. Зв'язки

- Key: `relations`
- Status: `READY_V1`
- Target: Організації, доходи, активи, сім'я, треті особи та граф
- Current gap: Graph engine і UI працюють; типи зв'язків ще розширюватимуться

### 4.11. Кросчекінг, метрики та сигнали

- Key: `analytics`
- Status: `PARTIAL`
- Target: Правило, severity, confidence, evidence, період, числові показники
- Current gap: Кілька правил існують, але немає універсального rule registry

### 4.12. Згадки та новини

- Key: `mentions`
- Status: `PARTIAL`
- Target: Дата, джерело, подія, confidence, кластер, URL
- Current gap: Mentions існують; автоматичний news intelligence ще неповний

### 4.13. Джерела та методологія

- Key: `methodology`
- Status: `MISSING`
- Target: Provenance, дата отримання, тип твердження, метод розрахунку
- Current gap: Джерела зберігаються, але немає окремої секції методології звіту

## 5. Мінімальна структура Report Model

```text
report
├── meta
├── subject
├── identity
├── executive_summary
├── declarations
├── career
├── related_people
├── income
├── cash_assets
├── real_estate
├── vehicles
├── relations
├── analytics
│   ├── metrics
│   ├── transitions
│   └── findings
├── mentions
├── sources
└── methodology
```

## 6. Evidence contract

Кожен аналітично значущий елемент повинен за можливості містити:

```text
value
year / period
source_document_id
source_url
source_provider
observed_at
statement_type
confidence
verification_status
rule_code
```

Внутрішні технічні поля не обов'язково показуються користувачу,
але повинні залишатися доступними для audit/debug.

## 7. Acceptance criteria A1

A1 вважається завершеним, коли:

- існує одна документована структура Report Model;
- усі ключові секції досьє мають визначену семантику;
- відокремлені facts, calculations, signals та AI analysis;
- визначений evidence contract;
- зафіксовано, які секції вже підтримуються, а які ще мають gaps;
- наступні UI/PDF/Excel зміни проектуються від Report Model, а не напряму від сирих таблиць.

## 8. Поточний пріоритет

Наступний етап після затвердження цієї специфікації:

`A2 — Subject Dossier / фінальна картка суб'єкта`

