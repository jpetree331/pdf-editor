// Framework-free. Central id mint so every id in the system is uniform.
import { nanoid } from 'nanoid'

export function newId(): string {
  return nanoid(10)
}
