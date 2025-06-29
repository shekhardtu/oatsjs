# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.11] - 2025-06-29

### Added
- Express + React + @hey-api example with axios client
- FastAPI + React + @hey-api example with fetch client
- Comprehensive example documentation with troubleshooting guides
- Examples .gitignore for build artifacts

### Changed
- Made frontend `port` and `startCommand` fields mandatory when frontend config is provided
- Moved `oats.config.json` to frontend directory in examples (best practice)
- Enhanced configuration validation with helpful error messages for missing frontend fields

### Fixed
- Fixed oats.config.json location in FastAPI example
- Fixed TypeScript version compatibility in examples
- Fixed missing dependencies in client generation

## [Unreleased]

### Added
- Complete TypeScript migration with strict type checking
- Comprehensive type definitions for all configuration options
- JSON Schema for IDE support and validation
- Custom error hierarchy for better error handling
- Jest test infrastructure with coverage reporting
- ESLint and Prettier configuration for code quality
- EditorConfig for consistent coding standards
- Proper project structure with separation of concerns
- Automatic package unlinking on shutdown to clean up linked packages
- Package manager detection for proper unlink commands (npm, yarn, pnpm)

### Changed
- Refactored entire codebase to TypeScript
- Improved configuration validation with detailed error messages
- Enhanced error handling with recoverable vs non-recoverable errors
- Updated build process to compile TypeScript
- Package linking is now tracked and automatically cleaned up on shutdown

### Fixed
- Configuration validation now properly handles all edge cases
- Frontend configuration is now properly optional
- Sync configuration uses sensible defaults
- Linked packages are now properly unlinked when stopping oatsjs

## [1.0.5] - 2024-06-28

### Changed
- Made frontend configuration optional
- Added default values for sync configuration

### Fixed
- Fixed validation schema to allow optional fields

## [1.0.4] - 2024-06-28

### Changed
- Significantly improved README documentation
- Added real-world examples
- Added common issues and solutions section
- Made documentation more user-friendly

## [1.0.3] - 2024-06-28

### Fixed
- Fixed path resolution to use process.cwd()
- Fixed configuration format mapping

## [1.0.2] - 2024-06-28

### Fixed
- Fixed validation schema for generateCommand
- Fixed lodash import issues

## [1.0.1] - 2024-06-28

### Added
- Initial configuration detection
- Support for custom generators

## [1.0.0] - 2024-06-28

### Added
- Initial release
- Automatic OpenAPI/Swagger synchronization
- Multi-service orchestration
- Smart change detection
- TypeScript client generation
- Hot-reload support

[Unreleased]: https://github.com/shekhardtu/oatsjs/compare/v1.0.5...HEAD
[1.0.5]: https://github.com/shekhardtu/oatsjs/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/shekhardtu/oatsjs/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/shekhardtu/oatsjs/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/shekhardtu/oatsjs/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/shekhardtu/oatsjs/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/shekhardtu/oatsjs/releases/tag/v1.0.0