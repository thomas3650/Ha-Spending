# HA Spending

HA Spending is an overview of a household's spending, read from [Firefly III](https://www.firefly-iii.org/) and shown
in Home Assistant's side menu. Click a main group to see its categories, a category to see every posting, for any
period, grouped by month, week or day.

It is a Home Assistant add-on: a small server that only reads Firefly III's API, and a page served through Home
Assistant's ingress. Nothing is written to Firefly III, and no posting is stored in Home Assistant.

**Status:** the skeleton: the page says "Hej" and the add-on's version. Reading Firefly III comes next; the
[mockups](docs/mockups/README.md) show where it is going.

**Install:** add this repository to Home Assistant's add-on store, as [`addon/DOCS.md`](addon/DOCS.md) describes.

## License

[MIT](LICENSE)
