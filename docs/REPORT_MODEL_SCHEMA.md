# Person Monitor — Report Model JSON Contract

Version: `report-model-v1`

## 1. Canonical builder

`buildSubjectReportModel(subjectId, options = {})`

Усі UI, PDF, Excel та Chat presentation layers повинні використовувати одну Report Model.
Canonical naming: `snake_case`.

## 2. Top-level sections

- `schema_version`
- `generated_at`
- `meta`
- `subject`
- `identity`
- `executive_summary`
- `declarations`
- `career`
- `related_people`
- `income`
- `cash_assets`
- `real_estate`
- `vehicles`
- `relations`
- `analytics`
- `mentions`
- `sources`
- `methodology`

## 3. Section contracts

### meta
`report_id`, `schema_version`, `analytics_version`, `period`, `available_years`, `freshness`.

### subject
`subject_id`, `entity_id`, `full_name`, `organization`, `position`, `city`, `status`.

Required: `subject_id`, `entity_id`, `full_name`.

### identity
`resolution_status`, `score`, `hard_match`, `review_required`, `identifiers`, `aliases`, `reasons`.

Identity rules:
- однаковий ПІБ сам по собі не є hard match;
- GUID документа декларації не є GUID особи;
- `probable` та `possible` залишаються reviewable.

### executive_summary
`status`, `items`.

Кожен item: `title`, `text`, `statement_type`, `severity`, `confidence`, `evidence`.

V1 summary формується детерміновано з analytics/findings; AI narrative дозволений лише поверх доказового контексту.

### declarations
`available_years`, `items`.

Кожен item: `year`, `source_document_id`, `document_guid`, `registry`, `published_at`, `source_url`, `canonical`.

Для одного року рівно одна декларація може бути `canonical: true`.

### career
`items`, `transitions`.

Career item: `year`, `organization`, `position`, `source_document_id`, `statement_type`, `evidence`.

До `career.items` потрапляють employment facts самого декларанта з канонічної декларації відповідного року.

Transition: `from_year`, `to_year`, `organization_changed`, `position_changed`, `statement_type`, `evidence`.

V1 формує transition лише між сусідніми роками. Порівняння виконується після нормалізації регістру, пробілів і пунктуації.

### related_people
`items`.

Person item: `entity_id`, `full_name`, `relation_type`, `role`, `relationship`, `years`, `identity_status`, `review_required`, `source_identity`, `statement_type`, `evidence`.

V1 relation types: `family_member`, `third_party_rightsholder`.

Family facts із декларації спочатку зберігаються як `source_observation`. `entity_id` залишається `null`, доки окремий identity layer не підтвердить конкретну сутність.

`source_identity.source_person_ref` є source-specific tracking signal і не вважається глобальним ідентифікатором людини.

Report Model не об’єднує family observations між роками лише за ПІБ, родинним зв’язком або `source_person_ref`.

Особи з `third_party_rightsholder` також додаються до `related_people` як окремі `source_observation`. Повторення тієї самої назви або участь у кількох активах не є підставою для автоматичного merge.

Для unresolved third-party observation `entity_id` залишається `null`, а `review_required = true`.

### income
`yearly`, `sources`.

Year item: `year`, `declarant_uah`, `family_uah`, `household_uah`, `source_document_id`, `statement_type`, `evidence`.

Source item: `year`, `recipient_role`, `recipient_name`, `recipient_relationship`, `income_type`, `other_income_type`, `amount`, `currency`, `source`, `source_details`, `source_document_id`, `statement_type`, `evidence`.

`source_details` містить лише безпечні нормалізовані поля: `source_type`, `company_name`, `edrpou`, `foreign_company_name`, `foreign_company_code`, `person_name`.

`income.sources` зберігає атомарні source facts. Записи не об’єднуються автоматично лише за текстовою назвою `source`, оскільки однакова назва не є достатнім ідентифікатором джерела.

`family_uah = household_uah - declarant_uah`.
Aggregate V1 використовує UAH; інші валюти не конвертуються неявно.

### cash_assets
`yearly`.

Year item: `year`, `declarant_by_currency`, `household_by_currency`, `items`, `evidence`.

Cash item: `asset_type`, `other_asset_type`, `amount`, `currency`, `currency_raw`, `organization_type`, `organization_name`, `owner_role`, `owner_name`, `owner_relationship`, `rights`, `source_document_id`, `statement_type`, `evidence`.

`declarant_by_currency` включає повну задекларовану суму cash asset один раз, якщо декларант є прямим owner або присутній серед `rights`.

`household_by_currency` включає повну задекларовану суму cash asset один раз, якщо декларант або член сім’ї є прямим owner чи присутній серед `rights`.

Для спільної власності сума не множиться на кількість правовласників і не ділиться на неіснуючі частки. `rights` зберігаються окремо.

Кожна валюта зберігається окремо. Відомі текстові варіанти UAH/USD/EUR нормалізуються до коду валюти; початкове значення зберігається у `currency_raw`. Конвертація валют не виконується.

### real_estate
`yearly[].items`.

Real estate item: `object_type`, `other_object_type`, `area`, `area_unit`, `location`, `acquisition_date`, `cost`, `owner_role`, `owner_name`, `owner_relationship`, `rights`, `tracking_identity`, `source_document_id`, `statement_type`, `evidence`.

`location`: `country`, `region`, `district`, `city`.

`tracking_identity` зберігає source-specific tracking signals: `source_system`, `source_item_ref` та `signature`.

`signature` містить нормалізовані доступні ознаки об’єкта: тип, площу, location та дату набуття. Вона не є доказом тотожності і сама по собі не використовується для автоматичного merge.

`source_item_ref` є сильним сигналом усередині джерела, але не вважається глобальним реєстраційним ідентифікатором.

Report Model не об’єднує real estate items між роками. Cross-year identity визначається окремим matching layer.

Якщо `person` відсутній, actor role не вигадується; власники та інші правовласники залишаються у `rights`.

### vehicles
`yearly[].items`.

Vehicle item: `object_type`, `other_object_type`, `brand`, `model`, `production_year`, `acquisition_date`, `cost`, `owner_role`, `owner_name`, `owner_relationship`, `rights`, `tracking_identity`, `source_document_id`, `statement_type`, `evidence`.

`tracking_identity` зберігає `source_system`, `source_item_ref` та `signature`.

Vehicle `signature` містить `brand`, `model`, `production_year`, `acquisition_date`.

`source_item_ref` є сильним source-specific signal, але не вважається глобальним реєстраційним ідентифікатором транспортного засобу.

Report Model не об’єднує vehicle items між роками. Cross-year identity визначається окремим matching layer.

Якщо `person` відсутній, actor role не вигадується; інформація про правовласника зберігається в `rights`.

### relations
`items`, `counts`.

Relation item: `relation_id`, `relation_type`, `relation_scope`, `from_entity_id`, `to_entity_id`, `from_entity_type`, `from_name`, `from_metadata`, `to_entity_type`, `to_name`, `to_metadata`, `label`, `year`, `confidence`, `verification_status`, `metadata`, `statement_type`, `evidence`.

`counts` містить кількість relation items за `relation_type`.

`relation_scope` розрізняє прямі (`direct`) та непрямі (`second_hop`) зв’язки.

Endpoint metadata проходять whitelist і не переносять raw metadata автоматично.

V1 relation types:
`employed_by`, `declared_asset`, `income_from`, `family_member_observed`, `third_party_rightsholder`, `resolved_to`.

### analytics
`metrics`, `transitions`, `findings`.

Finding: `rule_code`, `domain`, `result`, `severity`, `score`, `message`, `details`, `statement_type`, `evidence`.

`heuristic_signal` не є доказом правопорушення.

### mentions
`total`, `items`.

Mention item: `id`, `provider`, `title`, `snippet`, `url`, `published_at`, `first_seen_at`, `match_score`, `match_level`, `reasons`.

### sources
`items`.

Source item: `source_document_id`, `provider`, `external_id`, `url`, `published_at`, `observed_at`.

`raw_payload` не входить у public Report Model за замовчуванням.

### methodology
`report_model_version`, `analytics_version`, `rules_version`, `notes`, `limitations`.

## 4. Statement types

- `source_fact`
- `identity_resolution`
- `calculation`
- `heuristic_signal`
- `ai_analysis`

AI analysis ніколи не маскується під source fact.

## 5. Evidence contract

Аналітично значущий item може містити:
`source_document_id`, `provider`, `url`, `observed_at`, `statement_type`, `confidence`, `verification_status`, `rule_code`.

## 6. Null rules

- невідомий scalar -> `null`;
- відсутня collection -> `[]`;
- `0` використовується лише коли нуль реально обчислено;
- не створювати placeholder facts;
- presentation layer сам вирішує, як показувати `null`.

## 7. Public vs internal

Не показувати автоматично internal DB IDs, debugging metadata, raw payload або secrets.
Публічні source URLs та external identifiers використовувати дозволено.

## 8. A2 contract acceptance

- одна структура придатна для UI, PDF, Excel і Chat;
- facts, calculations, signals та AI analysis розділені;
- provenance підтримується;
- identity uncertainty не приховується;
- різні валюти не змішуються;
- schema розширюється новими providers і relation types без rewrite.
