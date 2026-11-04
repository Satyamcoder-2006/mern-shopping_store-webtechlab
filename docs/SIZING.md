# Size recommendation rules and research

Researched 4 November 2026.

Primary sources:

- [Nike body-measurement size guide](https://www.nike.com/gb/size-fit/mens-tops-alpha): dimensions are body measurements; height changes length requirements, including tall cuts.
- [Nike fit guidance](https://img.nike.com.hk/resources/sizecart/mens-tops-sizing-chart_en.html): chest is the main top-sizing reference when chest/waist sizes differ; fit preference matters at a boundary.
- [UNIQLO measurement guidance](https://faq-us.uniqlo.com/articles/en_US/FAQ/How-to-Measure): body measurements and measurements of the actual clothing are different. Product-specific measurements are preferable.

The app's existing FORME general chest/waist guide has been converted to centimetres and centralized in `shared/sizing.ts`. Shoulder bands are an explicitly authored general heuristic, not values validated by these brands. This is not a Nike/UNIQLO chart, trained ML model, health assessment or guaranteed fit prediction. It applies to the current general unisex chart; product-specific and women-specific charts are a future accuracy improvement.

Inputs: height in cm, weight in kg, measured waist circumference, point-to-point shoulder width, optional chest/bust and hip, and regular/roomier preference. Inputs are validated on the server and never persisted. Height and weight alone cannot establish chest/waist/shoulder circumference. They do not override the measured dimensions or manufacture a BMI-based clothing size.

Tops/layers use measured shoulder and waist plus chest when supplied, choosing the roomiest required band. This conservative choice can differ from a chest-only brand recommendation; the interface explicitly calls it a general estimate. Bottoms prioritize waist and advise checking hip/inseam because the current chart has no calibrated hip bands. Sets warn that top and bottom can require different sizes. A value in a gap goes to the larger band. Roomier preference steps up once, with a warning at XL. Measurements beyond the largest supported band return no suggested size. Height provides length warnings; weight is contextual input only. Hip is collected optionally for context and explicitly not scored without a calibrated chart.

The response states confidence/limitations and stock availability separately. An unavailable recommended size is never silently replaced by a stocked size. Users select a recommended size explicitly. Measuring tips and the actual general chart are visible on every product page.
