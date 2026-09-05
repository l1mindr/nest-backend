import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator';
import { WalletNetwork } from '../../domain/enums/wallet-network.enum';
import {
  WALLET_ADDRESS_HINTS,
  isValidWalletAddress
} from '../../domain/validation/wallet-address.rules';

/**
 * Validates an address against the network named by a sibling property.
 *
 * The rule depends on two fields at once, which a plain property decorator
 * cannot express — hence a constraint that reads the sibling off the object
 * under validation. The shapes themselves live in
 * `domain/validation/wallet-address.rules`, so this only wires them in.
 */
@ValidatorConstraint({ name: 'isWalletAddressForNetwork', async: false })
class IsWalletAddressForNetworkConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [networkProperty] = args.constraints as [string];
    const network = (args.object as Record<string, unknown>)[networkProperty];

    // A missing or unknown network is the network field's own error to
    // report; failing here too would put two messages on one mistake.
    if (
      typeof network !== 'string' ||
      !Object.values(WalletNetwork).includes(network as WalletNetwork)
    ) {
      return true;
    }

    if (typeof value !== 'string') return false;

    return isValidWalletAddress(network as WalletNetwork, value);
  }

  defaultMessage(args: ValidationArguments): string {
    const [networkProperty] = args.constraints as [string];
    const network = (args.object as Record<string, unknown>)[
      networkProperty
    ] as WalletNetwork;
    const hint = WALLET_ADDRESS_HINTS[network];

    return hint
      ? `address is not valid for ${network}: expected ${hint}`
      : 'address is not valid for the selected network';
  }
}

export function IsWalletAddressForNetwork(
  networkProperty: string,
  validationOptions?: ValidationOptions
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      constraints: [networkProperty],
      options: validationOptions,
      validator: IsWalletAddressForNetworkConstraint
    });
  };
}
