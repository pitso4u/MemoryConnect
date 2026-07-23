# Analytics

## Goal

Use memorial view information to understand public reach without inflated refresh counts.

**Estimated time:** 10 minutes  
**Requirements:** An authorised funeral home or SUPER_ADMIN account.

![Analytics](images/analytics.png)

## Memorial Analytics

1. Sign in.
2. Open **Memorials**.
3. Select the memorial.
4. Open the available analytics view.
5. Review total unique views and daily activity.

## How Views Are Counted

- A public visitor is counted at most once per memorial in a day.
- A visitor ID is stored in the browser.
- The server uses privacy-preserving hashing as a fallback.
- Raw IP addresses are not stored.
- Admin preview and family preview are excluded.
- Bots, service workers, asset loads, and background requests are excluded.

> **Note:** A different browser or device may count as another visitor.

## Platform Analytics

SUPER_ADMIN users can review:

- Total public views.
- Views today.
- Most viewed memorials.
- Funeral homes with the most memorials.
- Funeral homes with the highest verified revenue.

## Reading the Numbers

| Number | Useful Question |
|---|---|
| Total views | How many unique daily visitors opened this memorial? |
| Views today | Is the memorial currently being shared? |
| Most viewed | Which memorials have the widest reach? |
| Memorial count by funeral home | Which organisations use the platform most? |
| Revenue by funeral home | Which organisations generate the most verified publishing revenue? |

## Best Practices

- Compare memorials of similar age.
- Remember that public viewing lasts 30 days.
- Do not repeatedly refresh a page to test views.
- Use analytics as a service indicator, not a measure of family importance.

## Common Mistakes

- Expecting every refresh to increase the count.
- Comparing a newly published memorial with one shared for several weeks.
- Including preview visits in expected totals.
- Treating pending payments as revenue.
