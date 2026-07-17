import { Code2, FileCode2 } from 'lucide-react'

export function HomeFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0a0a0b] px-6 py-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <FileCode2 className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold text-white">ERBeauti</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-neutral-500">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-neutral-300"
          >
            <Code2 className="h-4 w-4" />
            GitHub
          </a>
          <span>&copy; {new Date().getFullYear()} ERBeauti</span>
        </div>
      </div>
    </footer>
  )
}
