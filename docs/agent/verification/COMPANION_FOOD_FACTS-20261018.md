# Companion food notes — 2026-10-18 KST

Scope: task110's food-detail copy and merged memories. Food IDs, draw weights, saved discoveries/tastes, art and eating behavior are unchanged. `food-facts.ts` contains one distinct, short Korean description for each of180foods. Notes describe visible structure, texture or ordinary cooking; they make no treatment, prevention, nutritional-dose or individual dietary claims. Unfound entries still expose only `???` and their silhouette in the collection UI.

## Copy and research

Descriptions are newly authored, not copied recipes. Common sensory/cooking descriptions use ordinary ingredient meanings. The less obvious plant distinctions and cooking forms below were checked against the following primary sources on2026-10-18. The sources do not constitute an independent review of every cultivar, recipe variant or every one of180sentences.

| Source | Checked application |
|---|---|
| [Kew: food seeds up close](https://www.kew.org/read-and-watch/vegetable-fruit-seeds-up-close) | Tomato is a botanical fruit; raw/cooked uses. Pepper/bean/fruit variety context. |
| [Kew: avocado](https://www.kew.org/plants/avocado) | Greenish flesh and one large seed. Full search retrieval succeeded; direct-open retry returned403. |
| [University of Maryland Extension: raspberries and blackberries](https://extension.umd.edu/resource/growing-raspberries-and-blackberries-home-garden) | Raspberry's hollow centre versus blackberry's retained core. |
| [National Tropical Botanical Garden: figs](https://ntbg.org/news/fig-wasp-fidelity/) | Tiny flowers develop inside the fig structure, avoiding the suggestion that ripe fruit simply contains unaltered flowers. |
| [Panoramic Fruit Company: rambutan](https://rambutan.com/) | Producer's description of the hairlike rind and white inner flesh. |
| [University of Minnesota: The Science of Plants](https://open.lib.umn.edu/horticulture/open/download?type=print_pdf) | Sweet potato stores in root tissue; avoid conflating it with potato's stem tuber. |
| [UF/IFAS: Carambola](https://ask.ifas.ufl.edu/publication/MG269) | Lengthwise ribs, star-shaped cross-section, smooth yellow skin. No medical/safety advice imported into game copy. |
| [UF/IFAS: Low-Maintenance Landscape Plants](https://ask.ifas.ufl.edu/publication/EP107) | Longan's brown peel and translucent pulp; lychee's rough reddish peel and pale translucent pulp. |
| [KTO: signature Chuseok recipes](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=224166) | Filled/steamed half-moon songpyeon, japchae's glass noodles/vegetables, pajeon. Search body succeeded; direct-open retry failed. |
| [KTO: Japchae](https://english.visitkorea.or.kr/svc/contents/contentsView.do?menuSn=181&vcontsId=179814) | Current noodles/vegetable preparation without inventing a single mandatory recipe. |
| [KTO: Black Sesame Tea Confectionery](https://english.visitkorea.or.kr/svc/thingsToDo/foodTrip/special_view.do?vcontsId=180903) | Powder/honey mixture pressed in patterned dasik moulds. |
| [KTO: Traditional Korean Sweets](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=182024) | Hangwa as the group of traditional sweets, including yakgwa/dasik. |
| [KTO: K-Desserts](https://spanish.visitkorea.or.kr/svc/contents/contentsView.do?menuSn=219&vcontsId=1574161) | Yakgwa's fried dough and syrup/honey finish. |
| [King Arthur Baking: Cream Puffs and Éclairs](https://www.kingarthurbaking.com/recipes/cream-puffs-and-eclairs-recipe) | Shared choux pastry, round puffs versus long éclairs and cream filling. |
| [King Arthur Baking: Almond Tea Cakes](https://www.kingarthurbaking.com/recipes/almond-tea-cakes-recipe) | Financiers use almond flour and butter. |
| [King Arthur Baking: Madeleine Cookies](https://www.kingarthurbaking.com/recipes/vanilla-madeleine-cookies-recipe) | Shell-shaped mould and raised opposite side. |
| [CaneLei pastry maker: cannelé](https://www.canelei.com/en/canneles/history) | Fluted form and baking/custard preparation; no unverified origin date retained. |

The unsuccessful guessed King Arthur canelé URL was not used as support. Search results from Wikipedia, Reddit, aggregators and mirrored domains were not used as technical/food authority. No external text or source image was incorporated verbatim into the product.

## Collection behavior

- Only two visible collection selectors remain: 냠냠 도감 and 추억 도감. The latter presents all12behavior stamps and12situation stamps in one24tile grid, with one roving keyboard stop and one detail area.
- Saved `behaviors` and `situations` remain distinct, preserving discovery evidence and wardrobe's discovered-only preview. The collection panel merely merges their presentation; it grants nothing.
- The inner `재롱 / 특별한 순간` category control is removed. Historical fixed activity options remain readable in analytics; actual memory-item inspection retains fixed `behavior` or `moment` types. Arrow navigation records the destination type when crossing the merged-grid boundary. No food/memory IDs enter activity metadata.
- Food detail retains rarity and base draw percentage, replaces the previous-item normalization sentence with the food note, and hides note/rarity/percentage for unknown food. The weighted draw algorithm is unchanged.

## Verification

Scoped units: `companion-food-facts`2 and actual `companion-profile-navigation`7,9/9PASS. ESLint passes for the food data, profile component, these two unit files and updated `companion-discovery-settings.spec.ts`. Units verify180unique/short notes, no medical/probability copy, Korean convenience-store rice-ball identity, two categories, merged24unknown stamps and keyboard cross-boundary deduplication. These checks do not prove native layout/focus.

Native production-fixture build `cZCDW_z5N1P6B5arnSrRu`, `http://127.0.0.1:3117`: six viewer/studio/preview × light/dark discovery cases plus fresh-empty case,7/7PASS in62.366s, skipped/flaky/unexpected0. They exercise the new native24grid, both stamp types, actual food note, unknown hiding, native keyboard focus across180foods/24memories, direct equipment/opening, reload and real sibling storage-event persistence. Source-specific inspection retains only fixed activity categories. API/write interceptions report0unexpected writes/pageerrors. Evidence: `.scratch-pw/companion-110/collection-report.json` and `collection-current-summary.json`; snapshots under `collection/` were visually inspected for food detail/unknown silhouettes and sticky merged-memory detail in light/dark viewer/studio surfaces.

Own product SHA256: `companion-profile.tsx`42797c338f9a4a2f1447b7177fc68a91d44bd8d506e8a4f43bb5c8acfb332c19; `food-facts.ts`b0ba10323a6d99cf85473255337c3d24962d002e8cec7c75db666a98b13bc629. Subsequent root parent-modal focus restoration changes do not alter these two files; final book-specific revalidation belongs to110's integrated record. Fixture evidence is not genuine-login/RLS or actual broadcaster hardware/speaker-listening evidence.
