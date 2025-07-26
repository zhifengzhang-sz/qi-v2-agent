# Command Parser Component Interface

## Overview

The Command Parser Component is responsible for parsing command-line arguments, validating command syntax, and extracting structured command data from raw user input. It serves as the entry point for all CLI interactions in the CLI Container.

## Component Responsibilities

- **Argument Parsing**: Parse `process.argv` into structured command data
- **Syntax Validation**: Validate command syntax and required parameters
- **Option Processing**: Handle flags, options, and positional arguments
- **Help Generation**: Generate help documentation and usage information
- **Error Reporting**: Provide clear error messages for invalid commands

## Public Interface

### ICommandParser

```typescript
interface ICommandParser {
  /**
   * Parse command line arguments into structured command
   * @param args Raw command line arguments (e.g., process.argv)
   * @returns Parsed command structure
   */
  parse(args: string[]): Promise<ParsedCommand>;
  
  /**
   * Validate parsed command structure
   * @param command Parsed command to validate
   * @returns Validation result with errors
   */
  validate(command: ParsedCommand): ValidationResult;
  
  /**
   * Register command definition for parsing
   * @param definition Command definition with options and validation
   */
  registerCommand(definition: CommandDefinition): void;
  
  /**
   * Get help text for command or all commands
   * @param commandName Optional specific command name
   * @returns Formatted help text
   */
  getHelp(commandName?: string): string;
  
  /**
   * Get list of available commands
   * @returns Map of command names to descriptions
   */
  getAvailableCommands(): Map<string, string>;
}
```

## Data Contracts

### Parsed Command Structure

```typescript
interface ParsedCommand {
  /**
   * Main command name
   */
  command: string;
  
  /**
   * Subcommand if applicable
   */
  subcommand?: string;
  
  /**
   * Named options and flags
   */
  options: CommandOptions;
  
  /**
   * Positional arguments
   */
  args: string[];
  
  /**
   * Raw unparsed arguments
   */
  raw: string[];
  
  /**
   * Metadata about parsing
   */
  metadata: ParseMetadata;
}

interface CommandOptions {
  [key: string]: string | number | boolean | string[];
}

interface ParseMetadata {
  /**
   * Original command line
   */
  originalArgs: string[];
  
  /**
   * Parsing timestamp
   */
  parsedAt: Date;
  
  /**
   * Parser version/configuration used
   */
  parserVersion: string;
  
  /**
   * Any warnings during parsing
   */
  warnings: string[];
}
```

### Command Definition

```typescript
interface CommandDefinition {
  /**
   * Command name
   */
  name: string;
  
  /**
   * Command description
   */
  description: string;
  
  /**
   * Command aliases
   */
  aliases?: string[];
  
  /**
   * Command options and flags
   */
  options: OptionDefinition[];
  
  /**
   * Positional arguments
   */
  arguments?: ArgumentDefinition[];
  
  /**
   * Subcommands
   */
  subcommands?: CommandDefinition[];
  
  /**
   * Examples of usage
   */
  examples?: CommandExample[];
  
  /**
   * Custom validation function
   */
  validator?: (command: ParsedCommand) => ValidationResult;
}

interface OptionDefinition {
  /**
   * Option name (long form)
   */
  name: string;
  
  /**
   * Short alias (single character)
   */
  alias?: string;
  
  /**
   * Option description
   */
  description: string;
  
  /**
   * Option type
   */
  type: 'string' | 'number' | 'boolean' | 'array';
  
  /**
   * Whether option is required
   */
  required: boolean;
  
  /**
   * Default value
   */
  default?: any;
  
  /**
   * Choices for enum-like options
   */
  choices?: string[];
  
  /**
   * Custom validation
   */
  validator?: (value: any) => boolean;
}

interface ArgumentDefinition {
  /**
   * Argument name
   */
  name: string;
  
  /**
   * Argument description
   */
  description: string;
  
  /**
   * Whether argument is required
   */
  required: boolean;
  
  /**
   * Whether argument accepts multiple values
   */
  variadic?: boolean;
}

interface CommandExample {
  /**
   * Example command line
   */
  command: string;
  
  /**
   * Description of what the example does
   */
  description: string;
}
```

### Validation Result

```typescript
interface ValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean;
  
  /**
   * Validation errors
   */
  errors: ValidationError[];
  
  /**
   * Validation warnings
   */
  warnings: ValidationWarning[];
  
  /**
   * Suggested corrections
   */
  suggestions: string[];
}

interface ValidationError {
  /**
   * Error code
   */
  code: ValidationErrorCode;
  
  /**
   * Human-readable error message
   */
  message: string;
  
  /**
   * Field or option that caused the error
   */
  field?: string;
  
  /**
   * Provided value that was invalid
   */
  value?: any;
}

enum ValidationErrorCode {
  UNKNOWN_COMMAND = 'UNKNOWN_COMMAND',
  MISSING_REQUIRED_OPTION = 'MISSING_REQUIRED_OPTION',
  INVALID_OPTION_VALUE = 'INVALID_OPTION_VALUE',
  MISSING_REQUIRED_ARGUMENT = 'MISSING_REQUIRED_ARGUMENT',
  TOO_MANY_ARGUMENTS = 'TOO_MANY_ARGUMENTS',
  INVALID_OPTION_TYPE = 'INVALID_OPTION_TYPE',
  CONFLICTING_OPTIONS = 'CONFLICTING_OPTIONS'
}

interface ValidationWarning {
  /**
   * Warning message
   */
  message: string;
  
  /**
   * Field that triggered warning
   */
  field?: string;
}
```

## Configuration Contract

### CommandParserConfig

```typescript
interface CommandParserConfig {
  /**
   * Parser behavior settings
   */
  behavior: ParserBehavior;
  
  /**
   * Help formatting options
   */
  help: HelpConfig;
  
  /**
   * Error handling configuration
   */
  errorHandling: ErrorHandlingConfig;
  
  /**
   * Command completion settings
   */
  completion?: CompletionConfig;
}

interface ParserBehavior {
  /**
   * Whether to allow unknown options
   */
  allowUnknownOptions: boolean;
  
  /**
   * Whether to treat options case sensitively
   */
  caseSensitive: boolean;
  
  /**
   * Whether to exit process on parsing errors
   */
  exitOnError: boolean;
  
  /**
   * Whether to automatically generate help commands
   */
  autoHelp: boolean;
  
  /**
   * Whether to automatically generate version commands
   */
  autoVersion: boolean;
}

interface HelpConfig {
  /**
   * Width of help output
   */
  width: number;
  
  /**
   * Whether to show option types in help
   */
  showTypes: boolean;
  
  /**
   * Whether to show default values in help
   */
  showDefaults: boolean;
  
  /**
   * Custom help header
   */
  header?: string;
  
  /**
   * Custom help footer
   */
  footer?: string;
}

interface ErrorHandlingConfig {
  /**
   * Whether to show suggestions for typos
   */
  showSuggestions: boolean;
  
  /**
   * Maximum edit distance for suggestions
   */
  suggestionThreshold: number;
  
  /**
   * Whether to show help on errors
   */
  showHelpOnError: boolean;
}

interface CompletionConfig {
  /**
   * Whether to enable tab completion
   */
  enabled: boolean;
  
  /**
   * Completion script generation
   */
  generateScript: boolean;
  
  /**
   * Custom completion handlers
   */
  customCompletions: Record<string, CompletionHandler>;
}

type CompletionHandler = (partial: string, command: ParsedCommand) => Promise<string[]>;
```

## Implementation Strategies

### Commander.js Integration

```typescript
class CommanderParserAdapter implements ICommandParser {
  private program: Command;
  private definitions: Map<string, CommandDefinition>;
  
  constructor(config: CommandParserConfig) {
    this.program = new Command();
    this.definitions = new Map();
    this.configureProgram(config);
  }
  
  async parse(args: string[]): Promise<ParsedCommand> {
    try {
      // Configure commands from definitions
      this.setupCommands();
      
      // Parse with Commander.js
      this.program.parse(args);
      
      // Convert Commander.js result to our format
      return this.convertToParsedCommand(this.program);
    } catch (error) {
      throw new ParseError(error.message, ValidationErrorCode.UNKNOWN_COMMAND);
    }
  }
  
  registerCommand(definition: CommandDefinition): void {
    this.definitions.set(definition.name, definition);
    // Update Commander.js configuration
    this.setupCommand(definition);
  }
  
  private setupCommand(definition: CommandDefinition): void {
    const cmd = this.program
      .command(definition.name)
      .description(definition.description);
    
    // Add options
    definition.options.forEach(opt => {
      const flags = opt.alias ? `-${opt.alias}, --${opt.name}` : `--${opt.name}`;
      cmd.option(flags, opt.description, opt.default);
    });
    
    // Add arguments
    definition.arguments?.forEach(arg => {
      const argStr = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
      cmd.argument(argStr, arg.description);
    });
  }
}
```

### Yargs Integration

```typescript
class YargsParserAdapter implements ICommandParser {
  private yargs: any;
  private config: CommandParserConfig;
  
  constructor(config: CommandParserConfig) {
    this.config = config;
    this.yargs = require('yargs');
    this.configureYargs();
  }
  
  async parse(args: string[]): Promise<ParsedCommand> {
    const parsed = this.yargs.parse(args);
    return this.convertToParsedCommand(parsed);
  }
  
  registerCommand(definition: CommandDefinition): void {
    this.yargs.command({
      command: definition.name,
      describe: definition.description,
      builder: (yargs: any) => {
        definition.options.forEach(opt => {
          yargs.option(opt.name, {
            alias: opt.alias,
            describe: opt.description,
            type: opt.type,
            required: opt.required,
            default: opt.default,
            choices: opt.choices
          });
        });
        return yargs;
      },
      handler: (argv: any) => {
        // Handler will be called by command router
      }
    });
  }
}
```

### Custom Parser Implementation

```typescript
class CustomCommandParser implements ICommandParser {
  private definitions: Map<string, CommandDefinition>;
  private config: CommandParserConfig;
  
  async parse(args: string[]): Promise<ParsedCommand> {
    const command = this.extractCommand(args);
    const definition = this.definitions.get(command);
    
    if (!definition) {
      throw new ParseError(`Unknown command: ${command}`, ValidationErrorCode.UNKNOWN_COMMAND);
    }
    
    const options = this.parseOptions(args, definition.options);
    const positionalArgs = this.parseArguments(args, definition.arguments);
    
    return {
      command,
      options,
      args: positionalArgs,
      raw: args,
      metadata: {
        originalArgs: [...args],
        parsedAt: new Date(),
        parserVersion: '1.0.0',
        warnings: []
      }
    };
  }
  
  private parseOptions(args: string[], optionDefs: OptionDefinition[]): CommandOptions {
    const options: CommandOptions = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const optionName = arg.slice(2);
        const definition = optionDefs.find(opt => opt.name === optionName);
        
        if (definition) {
          if (definition.type === 'boolean') {
            options[optionName] = true;
          } else {
            options[optionName] = args[i + 1];
            i++; // Skip next argument as it's the value
          }
        }
      } else if (arg.startsWith('-') && arg.length === 2) {
        const alias = arg.slice(1);
        const definition = optionDefs.find(opt => opt.alias === alias);
        
        if (definition) {
          if (definition.type === 'boolean') {
            options[definition.name] = true;
          } else {
            options[definition.name] = args[i + 1];
            i++;
          }
        }
      }
    }
    
    return options;
  }
}
```

## Error Handling

### Parse Errors

```typescript
class ParseError extends Error {
  constructor(
    message: string,
    public code: ValidationErrorCode,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

interface ParseErrorHandler {
  /**
   * Handle parsing errors
   */
  handleError(error: ParseError): ParseErrorResponse;
  
  /**
   * Generate suggestions for typos
   */
  generateSuggestions(input: string, availableCommands: string[]): string[];
}

interface ParseErrorResponse {
  /**
   * Error message to display
   */
  message: string;
  
  /**
   * Whether to show help
   */
  showHelp: boolean;
  
  /**
   * Exit code
   */
  exitCode: number;
  
  /**
   * Suggested corrections
   */
  suggestions: string[];
}
```

## Performance Considerations

### Caching

```typescript
interface ParserCache {
  /**
   * Cache parsed commands for repeated invocations
   */
  cacheResult(args: string[], result: ParsedCommand): void;
  
  /**
   * Get cached result
   */
  getCached(args: string[]): ParsedCommand | null;
  
  /**
   * Clear cache
   */
  clear(): void;
}
```

### Performance Requirements

- **Parse Time**: <10ms for simple commands, <50ms for complex commands
- **Memory Usage**: <5MB for parser state and command definitions
- **Help Generation**: <100ms for full help output
- **Validation**: <5ms for standard validations

## Testing Contract

### Testable Behaviors

```typescript
interface CommandParserTestSuite {
  /**
   * Test basic command parsing
   */
  testBasicParsing(testCases: ParseTestCase[]): TestResults;
  
  /**
   * Test option parsing
   */
  testOptionParsing(testCases: OptionTestCase[]): TestResults;
  
  /**
   * Test validation
   */
  testValidation(testCases: ValidationTestCase[]): TestResults;
  
  /**
   * Test error handling
   */
  testErrorHandling(testCases: ErrorTestCase[]): TestResults;
  
  /**
   * Test help generation
   */
  testHelpGeneration(testCases: HelpTestCase[]): TestResults;
}

interface ParseTestCase {
  name: string;
  input: string[];
  expected: ParsedCommand;
  description: string;
}

interface OptionTestCase {
  name: string;
  input: string[];
  expectedOptions: CommandOptions;
  description: string;
}
```

This Command Parser component provides the foundation for all CLI interactions, ensuring robust argument parsing, validation, and user-friendly error handling while maintaining flexibility for different parsing strategies and frameworks.