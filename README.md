# Bridge Builder

A small, original bridge construction puzzle that runs locally in a modern browser. It uses Canvas 2D and plain JavaScript; no engine, package install, or external assets are required.

## Run on Windows

1. Open the repository folder in File Explorer.
2. Double-click `index.html` to play.

If you prefer to run the game from a local server, open PowerShell in this folder and run:

```powershell
npx serve .
```

Open the local address printed in PowerShell. You can also use Python, if installed, with `python -m http.server 8000` and visit <http://localhost:8000>.

## Controls

- Choose Wood, Steel, Cable, Aluminum, or Concrete, then click a joint and another joint to connect them.
- Choose standard, reinforced, or heavy thickness. Thicker members cost more and use a higher game strength rating.
- Toggle Unlimited budget to build without the cap; material spending remains tracked.
- Click empty space inside the construction area to add a joint.
- Joints snap to the visible 25-unit grid; the two fixed anchors align to the same grid.
- Choose Erase, then click a beam or non-anchor joint. Erasing a joint also removes its attached beams. Right-click still erases as a shortcut.
- Use Undo to remove the most recent beam.
- Select Test bridge to send the truck along the connected bridge. Reset starts the level over.
- The truck drives only over a continuous path of concrete members. Wood, steel, cable, and aluminum can support the concrete deck but are not drivable surfaces.
- Press Escape to deselect a joint.

The material ledger shows total spend and each material's subtotal. Standard, reinforced, and heavy members have increasing cost and game strength. A failed beam is marked on the bridge; the report lists the member, midpoint, vehicle load position, failure mode, load-to-capacity comparison, and damage level.

The physics are a lightweight, fixed-step Verlet and distance-constraint simulation built for game feel. Material strength and cost are gameplay values, not engineering measurements.

## Tech stack

The project uses HTML, CSS, plain JavaScript, and the browser's Canvas 2D API. This keeps the game easy to run and inspect while the game loop and construction rules are still changing. The bridge solver is small and specific to this game so its break thresholds and behavior remain easy to tune.
