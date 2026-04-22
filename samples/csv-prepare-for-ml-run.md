# Sample Run: csv-prepare-for-ml

## Command

```bash
$ npx tsx src/cli.ts skills/csv-prepare-for-ml/skill.yaml \
    --input file=sales_data.csv \
    --workspace ./workspace
```

## Input

File `sales_data.csv` — 155 rows, 7 columns (`date`, `product`, `category`, `quantity`, `price`, `region`, `rating`). Same dataset as the csv-explore sample. Placed in `./workspace/` before running.

## Execution Log

```
Loaded skill: csv-prepare-for-ml
Mode: pipeline
Workspace: ./workspace

[Step handle_missing] starting...

[Tool] run_python({"code":"import pandas as pd; df = pd.read_csv('sales_data.csv'); print('Missing values:'); print(df.isnull().sum())"})
[Result] Missing values:
date         0
product      0
category     0
quantity     9
price        0
region       0
rating      13
dtype: int64

[Tool] run_python({"code":"import pandas as pd; df = pd.read_csv('sales_data.csv'); print('Shape:', df.shape); missing = df.isnull().sum(); print('Missing values:'); print(missing[missing > 0])"})
[Result] Shape: (155, 7)
Missing values:
quantity     9
rating      13
dtype: int64

[Tool] run_python({"code":"import pandas as pd; df = pd.read_csv('sales_data.csv'); quantity_median = df['quantity'].median(); rating_median = df['rating'].median(); print(f'Quantity median: {quantity_median}'); print(f'Rating median: {rating_median}')"})
[Result] Quantity median: 33.0
Rating median: 3.1

[Tool] run_python({"code":"import pandas as pd; import os; df = pd.read_csv('sales_data.csv'); df['quantity'] = df['quantity'].fillna(df['quantity'].median()); df['rating'] = df['rating'].fillna(df['rating'].median()); missing_after = df.isnull().sum(); print('BEFORE CLEANING:'); print('Missing values: quantity=9, rating=13'); print('AFTER CLEANING:'); print('Missing values:'); print(missing_after); os.makedirs('workspace', exist_ok=True); df.to_csv('workspace/cleaned.csv', index=False); print('Saved to workspace/cleaned.csv')"})
[Result] BEFORE CLEANING:
Missing values: quantity=9, rating=13
AFTER CLEANING:
Missing values:
date        0
product     0
category    0
quantity    0
price       0
region      0
rating      0
dtype: int64
Saved to workspace/cleaned.csv

[Tool] run_python({"code":"print('=== MISSING VALUE HANDLING COMPLETE ==='); print('• Total rows: 155 (no rows removed)'); print('  - quantity: 9 missing values filled with median (33.0)'); print('  - rating: 13 missing values filled with median (3.1)'); print('• Total missing values before: 22'); print('• Total missing values after: 0')"})
[Result] === MISSING VALUE HANDLING COMPLETE ===
• Total rows: 155 (no rows removed)
  - quantity: 9 missing values filled with median (33.0)
  - rating: 13 missing values filled with median (3.1)
• Total missing values before: 22
• Total missing values after: 0

[Step handle_missing] completed

[Step remove_duplicates] starting...

[Tool] run_python({"code":"import pandas as pd; df = pd.read_csv('workspace/cleaned.csv'); duplicate_count = df.duplicated().sum(); print('STEP 2: Duplicate Analysis'); print(f'Total rows: {len(df)}'); print(f'Duplicate rows found: {duplicate_count}'); print(f'Unique rows: {len(df) - duplicate_count}')"})
[Result] STEP 2: Duplicate Analysis
Total rows: 155
Duplicate rows found: 5
Unique rows: 150

[Tool] run_python({"code":"import pandas as pd; df = pd.read_csv('workspace/cleaned.csv'); duplicate_mask = df.duplicated(keep=False); duplicate_examples = df[duplicate_mask].sort_values(list(df.columns)); print('Examples of duplicate rows:'); print(duplicate_examples.head(10))"})
[Result] Rows involved in duplicates: 10
Examples of duplicate rows:
           date      product category  quantity   price region  rating
19   2024-02-10  Doohickey D   Sports       7.0   40.66   East     1.1
38   2024-02-10  Doohickey D   Sports       7.0   40.66   East     1.1
...

[Tool] run_python({"code":"import pandas as pd; df = pd.read_csv('workspace/cleaned.csv'); rows_before = len(df); df_deduped = df.drop_duplicates(keep='first'); rows_after = len(df_deduped); print(f'Rows before deduplication: {rows_before}'); print(f'Duplicate rows removed: {rows_before - rows_after}'); print(f'Rows after deduplication: {rows_after}')"})
[Result] STEP 3: Removing Duplicates
Rows before deduplication: 155
Duplicate rows removed: 5
Rows after deduplication: 150

[Tool] run_python({"code":"import pandas as pd; df = pd.read_csv('workspace/cleaned.csv'); df_deduped = df.drop_duplicates(keep='first'); df_deduped.to_csv('workspace/deduped.csv', index=False); print('Saved deduplicated dataset to workspace/deduped.csv')"})
[Result] STEP 5: Saving Deduplicated Dataset
Saved deduplicated dataset to 'workspace/deduped.csv'

[Step remove_duplicates] completed

[Step normalize] starting...

[Tool] run_python({"code":"import pandas as pd; df = pd.read_csv('workspace/deduped.csv'); print('STEP 2: Identifying numeric columns'); print('Data types:'); print(df.dtypes); numeric_cols = df.select_dtypes(include=['float64', 'int64']).columns.tolist(); non_numeric_cols = df.select_dtypes(exclude=['float64', 'int64']).columns.tolist(); print(f'Numeric columns: {numeric_cols}'); print(f'Non-numeric columns: {non_numeric_cols}')"})
[Result] STEP 2: Identifying numeric columns
Data types:
date            str
product         str
category        str
quantity    float64
price       float64
region          str
rating      float64
dtype: object
Numeric columns: ['quantity', 'price', 'rating']
Non-numeric columns: ['date', 'product', 'category', 'region']

[Tool] run_python({"code":"import pandas as pd; df = pd.read_csv('workspace/deduped.csv'); print('Original value ranges:'); print(f'quantity: {df[\"quantity\"].min():.2f} to {df[\"quantity\"].max():.2f}'); print(f'price: {df[\"price\"].min():.2f} to {df[\"price\"].max():.2f}'); print(f'rating: {df[\"rating\"].min():.2f} to {df[\"rating\"].max():.2f}')"})
[Result] Original value ranges:
quantity: 1.00 to 59.00
price: 7.98 to 199.21
rating: 1.00 to 4.90

[Tool] run_python({"code":"import pandas as pd; df = pd.read_csv('workspace/deduped.csv'); df_normalized = df.copy(); df_normalized['quantity'] = (df['quantity'] - df['quantity'].min()) / (df['quantity'].max() - df['quantity'].min()); df_normalized['price'] = (df['price'] - df['price'].min()) / (df['price'].max() - df['price'].min()); df_normalized['rating'] = (df['rating'] - df['rating'].min()) / (df['rating'].max() - df['rating'].min()); df_normalized.to_csv('workspace/normalized.csv', index=False); print('Saved normalized dataset to workspace/normalized.csv'); print(f'Shape: {df_normalized.shape}')"})
[Result] Saved normalized dataset to workspace/normalized.csv
Shape: (150, 7)

[Tool] run_python({"code":"import pandas as pd; df = pd.read_csv('workspace/normalized.csv'); print('Normalized ranges:'); print(f'quantity: {df[\"quantity\"].min():.3f} to {df[\"quantity\"].max():.3f}'); print(f'price: {df[\"price\"].min():.3f} to {df[\"price\"].max():.3f}'); print(f'rating: {df[\"rating\"].min():.3f} to {df[\"rating\"].max():.3f}')"})
[Result] Normalized ranges:
quantity: 0.000 to 1.000
price: 0.000 to 1.000
rating: 0.000 to 1.000

[Step normalize] completed

[Step split] starting...

[Tool] run_python({"code":"import pandas as pd; import numpy as np; df = pd.read_csv('workspace/normalized.csv'); np.random.seed(42); df_shuffled = df.sample(frac=1.0, random_state=42).reset_index(drop=True); total_rows = len(df_shuffled); train_size = int(0.8 * total_rows); test_size = total_rows - train_size; train_df = df_shuffled[:train_size]; test_df = df_shuffled[train_size:]; print(f'Total rows: {total_rows}'); print(f'Train size (80%): {train_size} rows'); print(f'Test size (20%): {test_size} rows')"})
[Result] STEP 3: Split into train and test sets
Total rows: 150
Train size (80%): 120 rows
Test size (20%): 30 rows

[Tool] run_python({"code":"import pandas as pd; import numpy as np; df = pd.read_csv('workspace/normalized.csv'); np.random.seed(42); df_shuffled = df.sample(frac=1.0, random_state=42).reset_index(drop=True); train_size = int(0.8 * len(df_shuffled)); train_df = df_shuffled[:train_size]; test_df = df_shuffled[train_size:]; train_df.to_csv('workspace/train.csv', index=False); test_df.to_csv('workspace/test.csv', index=False); print('Saved train.csv (120 rows)'); print('Saved test.csv (30 rows)')"})
[Result] STEP 5: Saved datasets
✓ train.csv (120 rows)
✓ test.csv (30 rows)

[Tool] run_python({"code":"import pandas as pd; train_verify = pd.read_csv('workspace/train.csv'); test_verify = pd.read_csv('workspace/test.csv'); print('VERIFICATION: Files saved successfully'); print(f'train.csv: {train_verify.shape}'); print(f'test.csv: {test_verify.shape}'); print(f'Total rows: {len(train_verify) + len(test_verify)}')"})
[Result] VERIFICATION: Files saved successfully
train.csv: (120, 7)
test.csv: (30, 7)
Total rows: 150

[Step split] completed

============================================================
RESULT:
============================================================
```

## Final Output

All 4 pipeline steps completed successfully in strict order:

| Step | Action | Result |
|------|--------|--------|
| handle_missing | Filled numeric NaN with median | quantity: 9 filled (median=33.0), rating: 13 filled (median=3.1) |
| remove_duplicates | Dropped duplicate rows (keep first) | 5 duplicates removed, 150 rows remaining |
| normalize | Min-max scaling on numeric columns | quantity, price, rating → [0.000, 1.000] |
| split | 80/20 train/test split (seed=42) | train.csv: 120 rows, test.csv: 30 rows |

Output files in workspace:
- `cleaned.csv` — after missing value handling (155 rows)
- `deduped.csv` — after deduplication (150 rows)
- `normalized.csv` — after normalization (150 rows)
- `train.csv` — training set (120 rows, 80%)
- `test.csv` — test set (30 rows, 20%)

## Note on Runtime Behaviour

During this run the model encountered repeated `NameError: name 'df' is not defined` errors. This is because `run_python` executes each call as a separate process — variables do not persist between calls. The model adapted by prepending `import pandas as pd; df = pd.read_csv(...)` to every subsequent call. This is a known limitation of the current `run_python` implementation (stateless execution via `python -c`).
