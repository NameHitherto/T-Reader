export default {
  extends: ['stylelint-config-standard-scss'],
  ignoreFiles: [
    'dist/**',
    'node_modules/**',
    'src-tauri/**',
    'libs/epub.js/**',
  ],
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
  ],
  rules: {
    'alpha-value-notation': null,
    'at-rule-empty-line-before': null,
    'color-function-alias-notation': null,
    'color-function-notation': null,
    'color-hex-length': null,
    'comment-empty-line-before': null,
    'custom-property-pattern': null,
    'custom-property-empty-line-before': null,
    'declaration-empty-line-before': null,
    'declaration-property-value-keyword-no-deprecated': null,
    'keyframes-name-pattern': null,
    'length-zero-no-unit': null,
    'media-feature-range-notation': null,
    'property-no-vendor-prefix': null,
    'rule-empty-line-before': null,
    'selector-not-notation': null,
    'selector-class-pattern': null,
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['deep', 'global'],
      },
    ],
    'scss/dollar-variable-pattern': null,
    'scss/at-rule-no-unknown': true,
    'scss/double-slash-comment-empty-line-before': null,
    'shorthand-property-no-redundant-values': null,
    'value-keyword-case': [
      'lower',
      {
        ignoreKeywords: ['currentColor'],
      },
    ],
  },
}
