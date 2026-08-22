const fs = require('fs');
const path = require('path');
const readline = require('readline');

const sourceDirectory = process.argv[2];
const outputPath = process.argv[3];

if (!sourceDirectory || !outputPath) {
  throw new Error(
    'Usage: node build-usda-food-catalog.js <source-directory> <output-path>'
  );
}

const sourceFiles = {
  food: 'food (2).csv',
  nutrients: 'food_nutrient (2).csv',
  portions: 'food_portion (2).csv',
  units: 'measure_unit (2).csv',
};

const includedDataTypes = new Set([
  'foundation_food',
  'sr_legacy_food',
  'survey_fndds_food',
]);

const nutrientIds = new Set([
  '1003',
  '1004',
  '1005',
  '1008',
  '2047',
  '2048',
]);

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value);
  return values;
}

async function readRows(fileName, onRow) {
  const filePath = path.join(sourceDirectory, fileName);
  const input = fs.createReadStream(filePath);
  const lines = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });
  let headers;

  for await (const line of lines) {
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }

    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    onRow(row);
  }
}

async function buildCatalog() {
  const foods = new Map();
  const units = new Map();

  await readRows(sourceFiles.food, (row) => {
    if (!includedDataTypes.has(row.data_type)) {
      return;
    }

    foods.set(row.fdc_id, {
      id: row.fdc_id,
      name: row.description,
      dataType: row.data_type,
      categoryId: row.food_category_id || null,
      nutrients: {},
      portions: [],
    });
  });

  await readRows(sourceFiles.units, (row) => {
    units.set(row.id, row.name);
  });

  await readRows(sourceFiles.portions, (row) => {
    const food = foods.get(row.fdc_id);

    if (!food) {
      return;
    }

    const gramWeight = Number(row.gram_weight);
    const amount = Number(row.amount);

    if (!Number.isFinite(gramWeight) || gramWeight <= 0) {
      return;
    }

    const unit = units.get(row.measure_unit_id) || '';
    const description =
      row.portion_description ||
      row.modifier ||
      [row.amount, unit].filter(Boolean).join(' ');

    food.portions.push({
      amount:
        Number.isFinite(amount) && amount > 0
          ? amount
          : 1,
      description: description || 'serving',
      gramWeight,
    });
  });

  await readRows(sourceFiles.nutrients, (row) => {
    if (!nutrientIds.has(row.nutrient_id)) {
      return;
    }

    const food = foods.get(row.fdc_id);

    if (!food) {
      return;
    }

    const amount = Number(row.amount);

    if (Number.isFinite(amount) && amount >= 0) {
      food.nutrients[row.nutrient_id] = amount;
    }
  });

  const catalog = [];

  for (const food of foods.values()) {
    const calories =
      food.nutrients['1008'] ??
      food.nutrients['2048'] ??
      food.nutrients['2047'];

    if (!Number.isFinite(calories)) {
      continue;
    }

    const portions = food.portions
      .sort((left, right) =>
        left.gramWeight - right.gramWeight
      )
      .slice(0, 8);

    catalog.push({
      id: food.id,
      name: food.name,
      dataType: food.dataType,
      caloriesPer100g: calories,
      proteinPer100g:
        food.nutrients['1003'] ?? 0,
      carbsPer100g:
        food.nutrients['1005'] ?? 0,
      fatPer100g:
        food.nutrients['1004'] ?? 0,
      portions,
    });
  }

  catalog.sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  fs.mkdirSync(path.dirname(outputPath), {
    recursive: true,
  });
  fs.writeFileSync(
    outputPath,
    JSON.stringify({
      source: 'USDA FoodData Central',
      nutrientBasis: 'per 100 g edible portion',
      generatedAt: new Date().toISOString(),
      foods: catalog,
    })
  );

  console.log(
    `Wrote ${catalog.length.toLocaleString()} foods to ${outputPath}`
  );
}

buildCatalog().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
