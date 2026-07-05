export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export const USERNAME_REGEX = new RegExp(
  `^(?!\\.)(?!.*\\.\\.)(?!.*\\.$)[a-zA-Z0-9._]{${USERNAME_MIN_LENGTH},${USERNAME_MAX_LENGTH}}$`
);
