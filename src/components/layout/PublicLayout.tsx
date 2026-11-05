import { useCallback, useEffect, useState } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router"
import { Menu, Search, ShoppingCart, X } from "lucide-react"

import { Logo } from "@/components/brand/Logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { homeForRole, useAuthStore } from "@/stores/auth"
import { useCartStore } from "@/stores/cart"
import "@/styles/motion.css"

const links = [
  { to: "/shop", label: "Shop" },
  { to: "/schools", label: "Shop by School" },
  { to: "/for-schools", label: "For schools" },
  { to: "/for-publishers", label: "For publishers" },
]

export function PublicLayout() {
  const user = useAuthStore((s) => s.user)
  const extrasCount = useCartStore((s) => Object.values(s.extras).reduce((a, b) => a + b, 0))
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null)
  const { pathname } = useLocation()
  const menuOpen = menuOpenOn === pathname


  const account = user ? (
    <Button asChild variant="outline">
      <Link to={homeForRole[user.roles[0]]}>My account</Link>
    </Button>
  ) : (
    <Button asChild variant="outline">
      <Link to="/sign-in">Sign in</Link>
    </Button>
  )

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="site-header sticky top-0 z-30 border-b bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-site items-center gap-x-7 px-5 lg:px-10 md:h-[72px]">
          <Link to="/" aria-label="SchoolShop home" className="flex shrink-0">
            <Logo label="" className="h-6 md:h-7" />
          </Link>
          <nav aria-label="Main" className="hidden gap-1 lg:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    "nav-link rounded-md px-2.5 py-3 text-[15px] font-semibold whitespace-nowrap text-ink",
                    isActive && "underline decoration-2 underline-offset-[6px]"
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <HeaderSearch id="header-search" className="hidden max-w-md grow lg:block" />
          <div className="ml-auto flex items-center gap-2 md:gap-2.5">
            <div className="hidden sm:block">{account}</div>
            <Button asChild aria-label={extrasCount ? `Cart, ${extrasCount} items` : "Cart"} className="relative">
              <Link to="/parent/checkout">
                <ShoppingCart aria-hidden />
                {extrasCount > 0 && (
                  <span key={extrasCount} aria-hidden className="badge-pop absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-sun text-[11px] font-bold text-ink">
                    {extrasCount}
                  </span>
                )}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="public-menu"
              onClick={() => setMenuOpenOn(menuOpen ? null : pathname)}
            >
              {menuOpen ? <X className="size-5.5" aria-hidden /> : <Menu className="size-5.5" aria-hidden />}
            </Button>
          </div>
        </div>
        <div className="px-5 pb-3 lg:hidden">
          <HeaderSearch id="header-search-mobile" />
        </div>
        {menuOpen && (
          <div id="public-menu" className="menu-enter border-t bg-surface px-5 pt-2 pb-5 lg:hidden">
            <nav aria-label="Main" className="flex flex-col">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    cn("flex h-12 items-center border-b text-base font-semibold", isActive && "text-accent-text")
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-4 grid gap-2.5 sm:hidden [&>a]:w-full">
              {account}
              {!user && (
                <Button asChild>
                  <Link to="/sign-up">Create an account</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </header>
      <main className="grow">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-site flex-wrap items-center justify-between gap-4 px-5 lg:px-10 py-8 text-sm text-muted-foreground">
          <Logo className="h-5.5" />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/help" className="text-ink/80 hover:underline">Help &amp; FAQs</Link>
            <Link to="/help" className="text-ink/80 hover:underline">Refunds</Link>
            <Link to="/help" className="text-ink/80 hover:underline">Privacy</Link>
            <Link to="/help" className="text-ink/80 hover:underline">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

/** Product search, always in the header. Typing filters the Shop after a pause; Enter searches immediately. */
function HeaderSearch({ id, className }: { id: string; className?: string }) {
  const { pathname, search: locationSearch } = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // On the Shop page, show the active search so it can be edited or cleared.
  const current = pathname === "/shop" ? (params.get("search") ?? "") : ""
  return (
    <HeaderSearchInput
      key={`${pathname}:${current}`}
      id={id}
      className={className}
      current={current}
      pathname={pathname}
      locationSearch={locationSearch}
      searchParams={params.toString()}
      navigate={navigate}
    />
  )
}

function HeaderSearchInput({
  id,
  className,
  current,
  pathname,
  locationSearch,
  searchParams,
  navigate,
}: {
  id: string
  className?: string
  current: string
  pathname: string
  locationSearch: string
  searchParams: string
  navigate: ReturnType<typeof useNavigate>
}) {
  const [value, setValue] = useState(current)
  const navigateToSearch = useCallback((text: string, replace: boolean) => {
    const next = new URLSearchParams(pathname === "/shop" ? searchParams : undefined)
    if (text) next.set("search", text)
    else next.delete("search")
    const qs = next.toString()
    const target = qs ? `/shop?${qs}` : "/shop"
    if (`${pathname}${locationSearch}` !== target) navigate(target, { replace })
  }, [locationSearch, navigate, pathname, searchParams])

  useEffect(() => {
    const text = value.trim()
    if (text === current.trim()) return
    const timer = window.setTimeout(() => navigateToSearch(text, true), 350)
    return () => window.clearTimeout(timer)
  }, [value, current, navigateToSearch])

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault()
        navigateToSearch(value.trim(), false)
      }}
    >
      <label htmlFor={id} className="sr-only">Search products</label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input id={id} name="search" type="search" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" enterKeyHint="search" placeholder="Search titles, subjects, publishers" className="h-10 rounded-full pl-10 text-sm md:text-sm" />
    </form>
  )
}
