import type { Participant } from '../types'

const adjectives = ['Amber','Azure','Bold','Bright','Calm','Clever','Cloudy','Cosmic','Dapper','Daring','Frosty','Gentle','Golden','Happy','Indigo','Jolly','Kind','Lively','Lucky','Mellow','Minty','Neon','Nimble','Quiet','Rapid','Silver','Sunny','Swift','Velvet','Vivid','Warm','Wild'] as const
const creatures = ['Badger','Bear','Bee','Bison','Cat','Crane','Deer','Dolphin','Falcon','Finch','Fox','Gecko','Heron','Koala','Lemur','Lynx','Manta','Marten','Moose','Moth','Otter','Owl','Panda','Quail','Raven','Robin','Seal','Sparrow','Tiger','Turtle','Whale','Wolf'] as const

const hashString = (value: string): number => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export const participantFromId = (id: string, isSelf = false): Participant => {
  const hash = hashString(id)
  const adjective = adjectives[hash % adjectives.length]
  const creature = creatures[(hash >>> 7) % creatures.length]
  const tag = id.slice(-2).toUpperCase()
  return {
    id,
    name: `${adjective} ${creature} · ${tag}`,
    initials: `${adjective[0]}${creature[0]}`,
    hue: hash % 360,
    isSelf,
  }
}
