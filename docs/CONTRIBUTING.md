# Contributing to Google Researcher MCP Server

First off, thank you for considering contributing to Google Researcher MCP Server! It's people like you that make this project better for everyone. This document provides guidelines and steps for contributing.

## Ways to Contribute

There are many ways to contribute to this project:

- **Code Contributions**: Implement new features or fix bugs
- **Documentation**: Improve or add documentation
- **Bug Reports**: Submit detailed bug reports
- **Feature Requests**: Suggest new features or improvements
- **Testing**: Help test the project and report issues

## Development Setup

1. **Fork the Repository**
   ```bash
   git clone <your-fork-url>
   cd google-researcher-mcp
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Run in Development Mode**
   ```bash
   npm run dev
   ```

## Pull Request Process

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write code that follows our coding standards
   - Add or update tests as necessary
   - Update documentation to reflect your changes

3. **Run Tests**
   ```bash
   npm test
   ```

4. **Commit Your Changes**
   ```bash
   git commit -m "Description of changes"
   ```

5. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Submit a Pull Request**
   - Fill in the pull request template
   - Reference any related issues
   - Describe what your changes do and why they should be included

7. **Code Review**
   - Maintainers will review your code
   - Address any feedback or requested changes
   - Once approved, your PR will be merged

## Coding Standards

- Follow the existing code style
- Use meaningful variable and function names
- Write clear comments for complex logic
- Keep functions focused on a single responsibility
- Add appropriate error handling

## Testing

- Write tests for new features.
- Ensure all tests pass (`npm test`) before submitting a PR.
- Aim for good test coverage (check with `npm run test:coverage`).
- Refer to the [Testing Guide](./testing-guide.md) for detailed information on running different types of tests (unit, integration, e2e) and debugging.

## Documentation

- Update documentation for any changed functionality
- Document new features thoroughly
- Use clear, concise language

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [MIT License](../LICENSE).

## Questions?

If you have any questions or need help, feel free to open an issue or reach out to the maintainers.

Thank you for your contributions!