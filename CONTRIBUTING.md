# Contributing to CryptoAI

First off, thank you for considering contributing to CryptoAI! 🎉

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Describe the behavior you observed and what you expected**
- **Include screenshots if relevant**
- **Include your environment details** (OS, Node version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**
- **List some examples of how it would be used**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code lints
5. Issue that pull request!

## Development Process

1. **Setup development environment**
   ```bash
   git clone https://github.com/Lingz450/CryptoAI.git
   cd CryptoAI
   pnpm install
   cp .env.example .env
   # Edit .env with your configuration
   pnpm db:push
   ```

2. **Create a branch**
   ```bash
   git checkout -b feature/my-new-feature
   ```

3. **Make your changes**
   - Write clear, commented code
   - Follow the existing code style
   - Add tests if applicable
   - Update documentation

4. **Test your changes**
   ```bash
   pnpm lint
   pnpm type-check
   pnpm test
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```
   
   Use conventional commits:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes (formatting, etc.)
   - `refactor:` Code refactoring
   - `test:` Adding or updating tests
   - `chore:` Maintenance tasks

6. **Push to your fork**
   ```bash
   git push origin feature/my-new-feature
   ```

7. **Open a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template

## Style Guide

### TypeScript

- Use TypeScript for all new code
- Avoid `any` types
- Use proper type definitions
- Export types from a central location

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas
- Use semicolons
- Follow ESLint rules

### Component Style

```typescript
// Good
export function MyComponent({ prop1, prop2 }: MyComponentProps) {
  return <div>...</div>;
}

// Bad
export default function MyComponent(props: any) {
  return <div>...</div>;
}
```

### Naming Conventions

- **Components**: PascalCase (`MyComponent.tsx`)
- **Utilities**: camelCase (`formatPrice.ts`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (`UserProfile`)

## Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # React components
├── lib/             # Utilities and services
│   ├── services/    # Business logic
│   ├── indicators/  # Technical indicators
│   └── exchanges/   # Exchange integrations
├── server/          # tRPC server
└── workers/         # Background jobs
```

## Testing

- Write tests for new features
- Maintain test coverage above 80%
- Use meaningful test descriptions
- Test edge cases

## Documentation

- Update README.md if needed
- Add JSDoc comments to functions
- Update FEATURES_OVERVIEW.md for new features
- Keep QUICK_START.md current

## Questions?

Feel free to open an issue with your question or join our [Discord community](https://discord.gg/cryptoai).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

