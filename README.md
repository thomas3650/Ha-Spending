# HA Spending

HA Spending is an overview of a household's spending, read from [Firefly III](https://www.firefly-iii.org/) and shown
in Home Assistant's side menu. Click a main group to see its categories, a category to see every posting, for any
period, grouped by month, week or day.

It is a Home Assistant add-on: a small server that reads Firefly III's API with a read-only token, and a page served
through Home Assistant's ingress. Nothing is written to Firefly III, and no posting is stored in Home Assistant.

**Status:** being designed. Nothing is built yet; the [mockups](docs/mockups/README.md) show where it is going.

## License

[MIT](LICENSE)
