/** Assemble des classes, en ignorant celles qui ne s'appliquent pas. */
export const cx = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');
