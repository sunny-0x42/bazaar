package bazaar

import (
	"chain"
	"strings"

	"gno.land/p/nt/avl/v0"
)

var (
	admins avl.Tree
	inited bool
	modules avl.Tree
)

func Init(cur realm) {
	if inited {
		panic("bazaar: already initialized")
	}
	if !cur.Previous().IsUserCall() {
		panic("bazaar: EOA only")
	}
	a := cur.Previous().Address()
	admins = avl.Tree{}
	modules = avl.Tree{}
	admins.Set(a.String(), true)
	inited = true
	chain.Emit("Init", "admin", a.String())
}

func requireInit() {
	if !inited {
		panic("bazaar: call Init first")
	}
}

func isAdminAddr(addr address) bool {
	return admins.Has(addr.String())
}

func requireAdmin(cur realm) {
	requireInit()
	if !cur.Previous().IsUserCall() {
		panic("bazaar: EOA only")
	}
	if !isAdminAddr(cur.Previous().Address()) {
		panic("bazaar: not admin")
	}
}

func IsAdmin(addr string) bool {
	requireInit()
	return admins.Has(strings.TrimSpace(addr))
}

func AdminCount() int {
	requireInit()
	return admins.Size()
}

func ListAdmins() string {
	requireInit()
	out := ""
	admins.Iterate("", "", func(key string, _ any) bool {
		if out != "" {
			out += "\n"
		}
		out += key
		return false
	})
	return out
}

func AddAdmin(cur realm, newAdmin address) {
	requireAdmin(cur)
	if !newAdmin.IsValid() {
		panic("bazaar: invalid address")
	}
	if isAdminAddr(newAdmin) {
		panic("bazaar: already admin")
	}
	admins.Set(newAdmin.String(), true)
	chain.Emit("AddAdmin", "addr", newAdmin.String())
}

func RemoveAdmin(cur realm, who address) {
	requireAdmin(cur)
	if !who.IsValid() {
		panic("bazaar: invalid address")
	}
	if !isAdminAddr(who) {
		panic("bazaar: not an admin")
	}
	if admins.Size() <= 1 {
		panic("bazaar: cannot remove last admin")
	}
	admins.Remove(who.String())
	chain.Emit("RemoveAdmin", "addr", who.String())
}

func SetModule(cur realm, name, path string) {
	requireAdmin(cur)
	name = strings.TrimSpace(name)
	path = strings.TrimSpace(path)
	if name == "" || len(name) > 32 {
		panic("bazaar: invalid name")
	}
	if path == "" || len(path) > 200 {
		panic("bazaar: invalid path")
	}
	if !strings.HasPrefix(path, "gno.land/") {
		panic("bazaar: path must start with gno.land/")
	}
	for _, c := range path {
		ok := (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '/' || c == '_' || c == '.' || c == '-'
		if !ok {
			panic("bazaar: path charset")
		}
	}
	for _, c := range name {
		ok := (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-'
		if !ok {
			panic("bazaar: name charset")
		}
	}
	modules.Set(name, path)
	chain.Emit("SetModule", "name", name, "path", path)
}

func GetModule(name string) string {
	requireInit()
	v := modules.Get(name)
	if v == nil {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return s
}

func ListModules() string {
	requireInit()
	out := ""
	modules.Iterate("", "", func(key string, value any) bool {
		path, _ := value.(string)
		if out != "" {
			out += "\n"
		}
		out += key + "|" + path
		return false
	})
	return out
}

func Render(path string) string {
	_ = path
	if !inited {
		return "# Bazaar hub\n\nCall `Init` after deploy.\n"
	}
	out := "# Bazaar hub\n\nUpgrade router for the marketplace. UI reads `GetModule`.\n\n"
	out += "## Modules\n\n"
	list := ListModules()
	if list == "" {
		out += "_None. Admin: `SetModule(name, path)`._\n"
	} else {
		out += "```\n" + list + "\n```\n"
	}
	out += "\n## API\n\n- `SetModule` / `GetModule` / `ListModules`\n- `AddAdmin` / `RemoveAdmin` / `IsAdmin`\n"
	return out
}
