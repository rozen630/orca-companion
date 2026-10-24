export function readCompanionProfile(text: string | undefined): {
  name: string
  soul: string
  invalid: boolean
} {
  const defaults = {
    name: '小鲸',
    soul: '坦诚、温暖、主动推进事情。默认用中文交流。',
    invalid: false
  }
  if (!text) {
    return defaults
  }
  try {
    const value: unknown = JSON.parse(text)
    if (
      value &&
      typeof value === 'object' &&
      'name' in value &&
      typeof value.name === 'string' &&
      'soul' in value &&
      typeof value.soul === 'string'
    ) {
      return { name: value.name, soul: value.soul, invalid: false }
    }
  } catch {
    return { ...defaults, invalid: true }
  }
  return { ...defaults, invalid: true }
}
