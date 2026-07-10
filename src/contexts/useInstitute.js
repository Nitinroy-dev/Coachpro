import { useContext } from 'react'
import { InstituteContext } from './InstituteContext'

export function useInstitute() {
  const context = useContext(InstituteContext)
  if (!context) {
    throw new Error('useInstitute must be used within InstituteProvider')
  }
  return context
}
