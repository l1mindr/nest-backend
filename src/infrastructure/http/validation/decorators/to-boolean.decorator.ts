import { Transform } from 'class-transformer';
import { toBoolean } from '../../../../core/utils/to-boolean';

export const ToBoolean = () => Transform(({ value }) => toBoolean(value));
