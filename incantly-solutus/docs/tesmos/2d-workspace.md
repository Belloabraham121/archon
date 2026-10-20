# 2D graph workspace

## Expression list and items

Items are expressions, notes, tables, inference, folders and images. Folders organize/visibility-scope items but do not create an evaluator namespace unless explicitly declared. Notes are rich instructional content with no mathematical output. Tables export typed list/column symbols.

The [live folder/image study](complex-animation-and-items.md#image-insertion-and-relationship-to-folders) confirmed that hiding a folder removes its child graphs, while collapsing it only hides child editor rows. Image creation is a separate asset/item workflow; placement can depend on formulas, but image bytes are not math source.

## Scene compiler

| Source type | Scene result | Algorithm |
| --- | --- | --- |
| `y=f(x)` | polyline/curve | adaptive screen-space sampling, discontinuity splitting |
| implicit relation | contour set | marching squares + refinement |
| inequality | fill region | signed-region clipping/rasterization |
| `(x(t),y(t))` | parametric curve | adaptive parameter sampling |
| list/table | points/lines | per-row evaluation and missing-value policy |
| image | textured world rectangle | formula-controlled placement |
| transformed figure | curves/polygons/segments after 3D-to-2D projection | shared transform functions and ordered layers |

## Viewport controls

Store x/y bounds, square scale, Cartesian/polar grid, axes, arrows, number labels, axis labels, minor gridlines, display size, contrast, braille, complex mode and degree/radian preference. Distinguish author-saved presentation defaults from a learner's temporary pan/zoom.

## Direct manipulation

Hit test in world coordinates. A draggable plotted point writes to its declared point source; a label/image drag writes to placement metadata. Hover/intersection/extremum information is derived and may be exported as a new expression—not silently embedded in a curve.

## Elaborate figures and projection

The supplied [Lionfish](https://www.desmos.com/calculator/y5ugyiadfb) uses a 2D graph workspace for a fish-like figure built from folders containing world transformations, parametrizations, colors, and shapes. A visible parameter `j` was playing; other expressions derive animation values from it. The displayed projection divides x/z by a y-dependent denominator, while rotations run before projection. Tesmos therefore needs reusable named functions, transform composition, draw-order grouping, and a projection primitive even inside the 2D workspace. Clip or reject points whose projection denominator approaches zero. The [original fish fixture](formula-scenes.md#4-fish-like-mathematical-figure) tests these capabilities.
