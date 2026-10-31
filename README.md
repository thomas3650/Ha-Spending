# HA Spending

HA Spending is an overview of a household's spending, read from [Firefly III](https://www.firefly-iii.org/) and shown
in Home Assistant's side menu. Click a main group to see its categories, a category to see every posting, for any
period, grouped by month, week or day.

It is a Home Assistant add-on: a small server that reads Firefly III's API, and a page served through Home Assistant's
ingress. The page writes nothing to Firefly III, and no posting is stored in Home Assistant. An optional endpoint lets
an AI sorter in another add-on set the category, and the shop, of new postings, within fixed limits.

**Status:** the server reads Firefly III and the page shows the spending: the overview, a main group, all postings and
a chosen month. It is not released yet. The [mockups](docs/mockups/README.md) show the screens.

**Install:** add this repository to Home Assistant's add-on store, as [`addon/DOCS.md`](addon/DOCS.md) describes.

## License

[MIT](LICENSE)
