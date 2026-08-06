import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  ...tseslint.configs.recommended,
  {
    // The document engine and tools are framework-free by convention:
    // they must run (and be unit-tested) in plain Node, no React.
    files: ['src/lib/**/*.ts', 'src/tools/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'react', message: 'src/lib and src/tools are framework-free.' },
                  { name: 'react-dom', message: 'src/lib and src/tools are framework-free.' }] },
      ],
    },
  },
)
