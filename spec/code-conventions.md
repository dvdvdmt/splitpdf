# Code conventions

## Project Rules
- Present tense
- Start with a verb
- Be direct and clear
- Focus on what the commit does
- Avoid conventional commit prefixes

## Use imperative style for commit messages
Use:
- Present tense
- Start with a verb
- Be direct and clear
- Focus on what the commit does
- Avoid conventional commit prefixes

Bad:
```
feat: add feature
```

Good:
```
Add feature
```

## Use for and for-of loops instead of forEach, map and filter

Bad:
```javascript
const arr = [1, 2, 3];
arr.forEach((el) => console.log(el));
```

Good:
```javascript
const arr = [1, 2, 3];
for (const el of arr) {
  console.log(el);
}
```

## Test name

## Using "should" in tests

Those 'should' prefixes are meaningless due to their repetition in each test. I personally always go with the *declarative testing* approach which simply states a fact about the expected outcome. This emphasizes describing the desired behavior of the code under test in a direct and concise manner.

In comparison:

- it should return the correct result for valid input
- it returns the correct result for valid input.

The latter form is less verbose and more direct.






## E2E test ids naming Convention
The following pattern MUST be used for `data-test-id` attributes:

`data-test-id="<componentName>_<elementName>[_<modifierOrId>]"`

Where:
- `<componentName>`: The name of the primary React component in `camelCase` (e.g., `taskDialog`, `kanbanColumn`, `taskCard`).
- `<elementName>`: A semantic name for the element within the component, also in `camelCase` (e.g., `titleInput`, `addTaskButton`, `cardHeader`, `statusSelectOption`).
- `[_<modifierOrId>]` (optional, separated by an underscore):
    - A `camelCase` descriptor for specific states, actions, or variants (e.g., `_submit`, `_openDialog`, `_todo`).
    - A dynamic value (like an item's ID or a unique key) when the element is part of a list or collection (e.g., `_task123`, `_johnDoe`).

### Examples:

TaskDialog Component (`taskDialog_` prefix):
- Dialog content: `data-test-id="taskDialog_content"`
- Title input field: `data-test-id="taskDialog_titleInput"`
- Description input field: `data-test-id="taskDialog_descriptionInput"`
- Status select trigger: `data-test-id="taskDialog_statusSelectTrigger"`
- A specific status option: `data-test-id="taskDialog_statusSelectOption_todo"`
- Form submission button: `data-test-id="taskDialog_submitButton"`

KanbanColumn Component (`kanbanColumn_` prefix):
- A specific column (e.g., "Todo"): `data-test-id="kanbanColumn_column_todo"`
- "Add Task" button within a column: `data-test-id="kanbanColumn_addTaskButton_todo"`

TaskCard Component (`taskCard_` prefix, assuming `task.id` is the unique identifier):
- The card itself: `data-test-id="taskCard_card_uiqueTaskId123"`
- Task title display: `data-test-id="taskCard_title_uiqueTaskId123"`
- Task description display: `data-test-id="taskCard_description_uiqueTaskId123"`
