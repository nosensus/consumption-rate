# Нормы расхода — прототип модуля

Интерактивный прототип на React + TypeScript для тестирования ТЗ модуля учёта норм расхода.
Назначение: проверить UX воркфлоу, логику расчётов и структуру данных до начала продакшн-разработки.

---

## Стек

| Инструмент | Версия | Зачем |
|---|---|---|
| React 19 | `^19.0.0` | UI |
| TypeScript | `~5.7.2` | Типы |
| Vite 6 | `^6.3.5` | Сборка / dev-сервер |
| Tailwind CSS 3 | `^3.4.17` | Стили |
| Zustand 5 | `^5.0.4` | Глобальный стор |
| React Router 7 | `^7.6.0` | Роутинг |
| date-fns 4 | `^4.1.0` | Расчёт дат |
| lucide-react | `^0.511.0` | Иконки |
| pnpm 10 | `10.13.1` | Пакетный менеджер |

---

## Быстрый старт

```bash
pnpm install
pnpm dev
```

Откроется на `http://localhost:5173`.

Данные хранятся в `localStorage`. Кнопка **ДМ** (оранжевая, правый верхний угол) сбрасывает
демо-данные до заводских.

---

## Архитектура проекта

```
src/
├── api/
│   └── fakeApi.ts          # Фейковый API: localStorage + ~150ms задержки
├── components/
│   ├── modals/
│   │   ├── ObjectModal.tsx  # Создание объекта учёта (с доп. полями)
│   │   ├── ResourceModal.tsx# Создание ресурса
│   │   └── EventModal.tsx   # Фиксация событий (замена / пополнение / расход)
│   └── ui/
│       ├── Modal.tsx        # Базовый компонент модалки
│       ├── Badge.tsx        # Бейджи статуса
│       └── Toast.tsx        # Всплывающие уведомления
├── pages/
│   ├── Dashboard/           # Сводный дашборд: статистика + ближайшие события
│   ├── NormsList/           # Таблица норм с фильтрами и управлением статусами
│   ├── NormBuilder/         # Визард создания нормы (4 шага)
│   ├── NormCard/            # Карточка нормы: метрики, история событий
│   ├── References/          # Справочники: вкладки «Объекты» и «Ресурсы»
│   ├── ObjectsManager/      # (legacy, не используется в роутинге)
│   └── ResourcesManager/    # (legacy, не используется в роутинге)
├── store/
│   └── useStore.ts          # Zustand-стор: CRUD + тосты + loadAll()
├── types/
│   └── index.ts             # Все TypeScript-типы
├── utils/
│   └── calculations.ts      # Расчёт eventDate / notificationDate / daysLeft
├── App.tsx                  # Роутинг, сайдбар, топбар
├── index.css                # Tailwind + кастомные классы (.btn-primary, .card, .input…)
└── main.tsx                 # Точка входа
```

---

## Структура данных

### Основные сущности

```
ObjectType          Тип объекта (оборудование, склад, продукт…)
AccountingObject    Объект учёта (конкретная машина, склад, линия)
Resource            Ресурс (подшипник, масло, полипропилен…)
ConsumptionNorm     Норма расхода — связывает объект с ресурсом
NormEvent           Событие по норме (замена, пополнение, расход)
Notification        Уведомление (генерируется автоматически)
```

### Типы норм (`NormType`)

| Тип | Описание | Ключевые параметры |
|---|---|---|
| `time` | Замена по времени | `startDate`, `lifeValue`, `lifeUnit` |
| `usage` | По пробегу / моточасам / циклам | `totalResource`, `currentUsage`, `dailyUsage` |
| `stock` | Контроль остатка | `currentStock`, `dailyConsumption`, `minStock` |
| `product` | Расход на единицу продукции | `outputPlan`, `resourcePerUnit`, `availableStock` |

### Статусы нормы

`draft` → `active` → `overdue` / `paused` / `completed` → `archived`

Статус пересчитывается автоматически при каждом вызове `computeNormDates()` в fakeApi.

---

## Навигация

```
/                   Дашборд
/norms              Список норм
/norms/new          Визард создания нормы
/norms/:id          Карточка нормы
/references         Справочники (редирект на /references/objects)
/references/objects Объекты учёта
/references/resources Ресурсы
```

Сайдбар содержит три пункта: **Дашборд**, **Нормы**, **Справочники**.
Кнопка «Создать норму» в топбаре скрывается на странице `/norms/new`.

---

## Расчёт дат

Файл `src/utils/calculations.ts` — `calculate(norm): CalcResult`.

Для каждого типа нормы вычисляются:
- `eventDate` — дата планового события (замена, окончание запаса…)
- `notificationDate` — `eventDate` минус `warningValue` в `warningUnit`
- `daysLeft` — дней до события от сегодня
- `details` — человекочитаемое объяснение расчёта

Побочные эффекты событий (в `fakeApi.ts`):
- `replacement` → сбрасывает цикл нормы (новая `startDate` или `lastReplacementDate`)
- `refill` → увеличивает `currentStock` / `availableStock`
- `consumption` → уменьшает остаток / увеличивает `currentUsage`

---

## Кастомные CSS-классы

Определены в `src/index.css` через `@layer components`:

| Класс | Применение |
|---|---|
| `.btn-primary` | Основная кнопка (синяя) |
| `.btn-secondary` | Вторичная кнопка (белая, с рамкой) |
| `.btn-ghost` | Призрачная кнопка (серый текст) |
| `.card` | Белая карточка с тенью |
| `.input` | Поле ввода |
| `.label` | Подпись к полю |

Дизайн-токены: sidebar `#1A2048`, accent `#4F73F7`, bg `#F0F2FA`.

---

## Claude Code + Cartographer

Проект настроен для работы с [Claude Code](https://claude.ai/code) и плагином **Cartographer**,
который генерирует навигационный атлас кодовой базы.

### Команды Cartographer

```bash
# Сгенерировать атлас (карту доменов, паттернов, соглашений)
/cartographer:chart

# Обновить атлас после значительных изменений
/cartographer:rechart

# Проверить актуальность атласа
/cartographer:health

# Быстрый поиск: где находится X?
/cartographer:where <запрос>

# Добавить найденный паттерн в атлас
/cartographer:capture

# Добавить осведомлённость об атласе в CLAUDE.md
/cartographer:orient
```

### Navigator — разработка по спецификации

```bash
# Создать спецификацию задачи с учётом паттернов проекта
/navigator:plan <задача>

# Реализовать по спецификации
/navigator:build <путь к спеку>

# Проверить реализацию против спека и паттернов
/navigator:review <путь к спеку>
```

### Типичный воркфлоу

```
1. /cartographer:chart          — первоначальная генерация атласа
2. /cartographer:orient         — вшить атлас в CLAUDE.md
3. /navigator:plan <задача>     — спецификация новой фичи
4. /navigator:build <спек>      — реализация
5. /cartographer:rechart        — обновить атлас
```

Атлас хранится в `.claude/skills/atlas/` и автоматически подхватывается
Claude Code при последующих сессиях.

---

## Известные ограничения прототипа

- Нет авторизации — одна сессия, один пользователь
- Данные живут только в `localStorage` текущего браузера
- `ObjectsManager` и `ResourcesManager` в `src/pages/` не используются в роутинге
  (функциональность перенесена в `References`), но не удалены намеренно — для сравнения
- Email-уведомления не реализованы (только визуальный счётчик в топбаре)
