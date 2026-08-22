const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const jsonPath = path.join(
  projectRoot,
  'assets',
  'exercises',
  'exercises.json'
);

const outputPath = path.join(
  projectRoot,
  'components',
  'exercise-library',
  'exerciseMedia.ts'
);

const exercises = JSON.parse(
  fs.readFileSync(jsonPath, 'utf8')
);

const imageLines = [];
const gifLines = [];

for (const exercise of exercises) {
  if (exercise.image) {
    const imagePath = exercise.image.replace(/\\/g, '/');

    imageLines.push(
      `  '${exercise.id}': require('../../assets/exercises/${imagePath}'),`
    );
  }

  if (exercise.gif_url) {
    const gifPath = exercise.gif_url.replace(/\\/g, '/');

    gifLines.push(
      `  '${exercise.id}': require('../../assets/exercises/${gifPath}'),`
    );
  }
}

const output = `
export const exerciseImages: Record<string, any> = {
${imageLines.join('\n')}
};

export const exerciseGifs: Record<string, any> = {
${gifLines.join('\n')}
};

export function getExerciseImage(id: string) {
  return exerciseImages[id];
}

export function getExerciseGif(id: string) {
  return exerciseGifs[id];
}
`;

fs.writeFileSync(
  outputPath,
  output.trim() + '\n',
  'utf8'
);

console.log(
  `Created exerciseMedia.ts with ${imageLines.length} images and ${gifLines.length} GIFs.`
);
