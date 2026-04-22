# Sample Run: csv-prepare-for-ml

## Command

```bash
$ npx tsx src/cli.ts skills/csv-prepare-for-ml/skill.yaml \
    --input file=sales_data.csv \
    --workspace ./workspace
```

## Input

File `sales_data.csv` — 155 rows, 7 columns. Same dataset as csv-explore sample. Placed in `./workspace/` before running.

## Execution Log

```
Loaded skill: csv-prepare-for-ml
Mode: pipeline
Workspace: ./workspace

[Step handle_missing] starting...

[Tool] run_python({"code":"import pandas as pd\nimport numpy as np\ndf = pd.read_csv('sales_data.csv')\nprint('Shape:', df.shape)\nmissing = df.isnull().sum()\nprint('Missing values:')\nprint(missing[missing > 0])"})
[Result] Shape: (155, 7)
Missing values:
quantity     9
rating      13
dtype: int64

[Tool] run_python({"code":"import pandas as pd\nimport numpy as np\ndf = pd.read_csv('sales_data.csv')\nnumeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()\nfor col in numeric_columns:\n    if df[col].isnull().sum() > 0:\n        median_value = df[col].median()\n        missing_count = df[col].isnull().sum()\n        df[col] = df[col].fillna(median_value)\n        print(f'Filled {missing_count} missing in {col} with median: {median_value:.2f}')\nprint('Total missing after:', df.isnull().sum().sum())\ndf.to_csv('cleaned.csv', index=False)\nprint('Saved cleaned.csv')"})
[Result] Filled 9 missing in quantity with median: 33.00
Filled 13 missing in rating with median: 3.10
Total missing after: 0
Saved cleaned.csv

[Step handle_missing] completed

[Step remove_duplicates] starting...

[Tool] run_python({"code":"import pandas as pd\ndf = pd.read_csv('cleaned.csv')\nrows_before = len(df)\nduplicates = df.duplicated().sum()\nprint(f'Rows before: {rows_before}')\nprint(f'Duplicates found: {duplicates}')\ndf_deduped = df.drop_duplicates(keep='first')\nrows_after = len(df_deduped)\nprint(f'Rows after: {rows_after}')\nprint(f'Remaining duplicates: {df_deduped.duplicated().sum()}')\ndf_deduped.to_csv('deduped.csv', index=False)\nprint('Saved deduped.csv')"})
[Result] Rows before: 155
Duplicates found: 5
Rows after: 150
Remaining duplicates: 0
Saved deduped.csv

[Step remove_duplicates] completed

[Step normalize] starting...

[Tool] run_python({"code":"import pandas as pd\nimport numpy as np\ndf = pd.read_csv('deduped.csv')\nnumeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()\nprint('Numeric columns:', numeric_columns)\ndf_normalized = df.copy()\nfor col in numeric_columns:\n    col_min = df[col].min()\n    col_max = df[col].max()\n    df_normalized[col] = (df[col] - col_min) / (col_max - col_min)\n    print(f'{col}: [{col_min:.2f}, {col_max:.2f}] -> [{df_normalized[col].min():.4f}, {df_normalized[col].max():.4f}]')\ndf_normalized.to_csv('normalized.csv', index=False)\nprint('Saved normalized.csv')"})
[Result] Numeric columns: ['quantity', 'price', 'rating']
quantity: [1.00, 59.00] -> [0.0000, 1.0000]
price: [7.98, 199.21] -> [0.0000, 1.0000]
rating: [1.00, 4.90] -> [0.0000, 1.0000]
Saved normalized.csv

[Step normalize] completed

[Step split] starting...

[Tool] run_python({"code":"import pandas as pd\nimport numpy as np\ndf = pd.read_csv('normalized.csv')\nnp.random.seed(42)\ndf_shuffled = df.sample(frac=1, random_state=42).reset_index(drop=True)\nsplit_index = int(len(df_shuffled) * 0.8)\ntrain_df = df_shuffled.iloc[:split_index].reset_index(drop=True)\ntest_df = df_shuffled.iloc[split_index:].reset_index(drop=True)\nprint(f'Total rows: {len(df)}')\nprint(f'Train rows: {len(train_df)} ({len(train_df)/len(df)*100:.1f}%)')\nprint(f'Test rows: {len(test_df)} ({len(test_df)/len(df)*100:.1f}%)')\nprint(f'Verification: {len(train_df) + len(test_df)} == {len(df)}')\ntrain_df.to_csv('train.csv', index=False)\ntest_df.to_csv('test.csv', index=False)\nprint('Saved train.csv and test.csv')"})
[Result] Total rows: 150
Train rows: 120 (80.0%)
Test rows: 30 (20.0%)
Verification: 150 == 150
Saved train.csv and test.csv

[Step split] completed

============================================================
RESULT:
============================================================
```

## Final Output

All 4 pipeline steps completed in strict order:

| Step | Action | Result |
|------|--------|--------|
| handle_missing | Filled numeric NaN with median | quantity: 9 filled (median=33.0), rating: 13 filled (median=3.1). Total missing: 0 |
| remove_duplicates | Dropped duplicates (keep first) | 5 removed, 150 rows remaining |
| normalize | Min-max scaling: (x − min) / (max − min) | quantity, price, rating → [0.0, 1.0] |
| split | 80/20 shuffle split (seed=42) | train.csv: 120 rows, test.csv: 30 rows |

Output files in `./workspace/`:

| File | Rows | Description |
|------|------|-------------|
| `cleaned.csv` | 155 | After missing value imputation |
| `deduped.csv` | 150 | After duplicate removal |
| `normalized.csv` | 150 | After min-max normalization |
| `train.csv` | 120 | Training set (80%) |
| `test.csv` | 30 | Test set (20%) |

## Note on Stateless Execution

Each `run_python` call runs in an isolated process — variables do not persist between calls. The model adapted by reloading data at the start of each call (`pd.read_csv(...)`). This is a known characteristic of the current `run_python` implementation and is documented in NOTES.md.
