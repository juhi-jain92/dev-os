// File upload security checks. Source: security-foundation skill §7.
const ALLOWED_EXTENSIONS = ['.pdf']
const BLOCKED_EXTENSIONS = ['.exe', '.js', '.mjs', '.cjs', '.php', '.zip', '.sh', '.bat', '.cmd', '.py', '.rb', '.ps1']

export function getExtension(fileName: string): string {
  const match = fileName.match(/\.[^.]+$/)
  return match ? match[0].toLowerCase() : ''
}

export function isAllowedExtension(fileName: string): boolean {
  const ext = getExtension(fileName)
  if (BLOCKED_EXTENSIONS.includes(ext)) return false
  return ALLOWED_EXTENSIONS.includes(ext)
}

// Strips path separators and any character outside a safe set so a
// user-controlled file name can never be used to traverse or escape the
// intended Storage path (e.g. "../../other-user/secret.pdf").
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? 'contract.pdf'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_')
  return cleaned.slice(-200) || 'contract.pdf'
}
