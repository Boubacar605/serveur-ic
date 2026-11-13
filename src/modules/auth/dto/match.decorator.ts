import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function Match(property: string, options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'match',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options,
      constraints: [property],
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [relatedProperty] = args.constraints as [string];
          return value === (args.object as Record<string, unknown>)[relatedProperty];
        },
        defaultMessage(args: ValidationArguments): string {
          const [relatedProperty] = args.constraints as [string];
          return `${args.property} must match ${relatedProperty}`;
        },
      },
    });
  };
}
