import deepmerge from 'deepmerge';

export default function merge<T>(defaultValue: T, overrideValue: Partial<T>): T {
    return deepmerge(defaultValue, overrideValue);
}
