# Guardian Flat Design System Implementation

Guardian now uses the supplied dark flat system as its visual contract. Containers are separated by intentional background value steps rather than visible strokes, shadows, or gradients. Bright green is reserved for the active state and primary action, always paired with dark accent text.

| System rule | Guardian implementation |
| --- | --- |
| No visible borders | Cards, inputs, controls, navigation, and review panels use borderless flat fills. |
| No gradients or shadows | Existing decorative elevation was removed in favor of page, card, and recessed-input color steps. |
| Solid selected state | Selected cases, active desktop navigation, network toggles, active bottom-navigation icons, and primary actions use the accent fill. |
| Dark text on accent | Every accent-filled primary control and selected state uses `--accent-text`. |
| Permitted dividers | Only the evidence strip uses a 1 px background gap to separate internal content cells. |

The system retains Guardian’s custom sentinel and icon family while making the product calmer, flatter, and more deliberate across portfolio, scan, activity, and profile views.

## Final Token and Typography Pass

The final stylesheet holds one canonical `--accent: #8CF06B` definition at the root, with no inline style override or self-referential variable. Guardian headings now use a 500 weight with the specified primary text color; body copy uses the secondary text role; and uppercase metadata labels use the 10.5 px monospace label role. The final mobile and desktop reviews confirmed that the flat selected-state treatment, bottom navigation, network toggle, and primary wallet pill remain legible without visible container strokes.
