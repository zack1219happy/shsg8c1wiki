import { test, expect } from '@playwright/test'

test.describe('#0037 文章集锦', () => {
  test('广场隐藏子文章，集锦页展示全部文章并支持分层返回', async ({ page }) => {
    await page.goto('/plaza')
    await page.waitForLoadState('networkidle')

    await expect(
      page.locator('[data-plaza-result-type="article"]').filter({ hasText: 'AC与余晖 第七幕' }),
    ).toHaveCount(0)

    const collectionCard = page
      .locator('[data-plaza-result-type="collection"]')
      .filter({ hasText: 'AC与余晖 第七幕' })
      .first()
    await expect(collectionCard).toBeVisible()
    await expect(collectionCard).toContainText('AC与余晖')
    await collectionCard.click()
    await expect(page).toHaveURL(/\/plaza\/collection\?/)

    const childArticle = page
      .locator('[data-plaza-collection-article="true"]')
      .filter({ hasText: 'AC与余晖 第七幕' })
    await expect(childArticle).toBeVisible()
    await childArticle.click()
    await expect(page).toHaveURL(/\/plaza\/post\?/)
    await expect(page.getByRole('button', { name: /上一篇.*AC与余晖 第六幕/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /下一篇.*没有下一篇/ })).toBeDisabled()

    await page.locator('button[title="返回集锦"]').click()
    await expect(page).toHaveURL(/\/plaza\/collection\?/)
    await page.getByRole('button', { name: '← 返回文章广场' }).click()
    await expect(page).toHaveURL(/\/plaza(?:\?|$)/)
  })

  test('搜索命中子文章时同时显示文章和集锦', async ({ page }) => {
    await page.goto('/plaza')
    await page.waitForLoadState('networkidle')
    await page.getByTitle('搜索文章').click()
    await page.getByPlaceholder('搜索标题、内容或作者…').fill('关于贪吃蛇')

    const articleResult = page
      .locator('[data-plaza-result-type="article"]')
      .filter({ hasText: 'AC与余晖 第七幕' })
    const collectionResult = page
      .locator('[data-plaza-result-type="collection"]')
      .filter({ hasText: 'AC与余晖 第七幕' })
    await expect(articleResult).toBeVisible()
    await expect(collectionResult).toBeVisible()

    await articleResult.click()
    await expect(page).toHaveURL(/from=collection/)
  })

  test('关于只有两字公共前缀时保持普通文章', async ({ page }) => {
    await page.goto('/plaza')
    await page.waitForLoadState('networkidle')
    await page.getByTitle('搜索文章').click()
    await page.getByPlaceholder('搜索标题、内容或作者…').fill('关于贪吃蛇')

    await expect(
      page.locator('[data-plaza-result-type="article"]').filter({ hasText: '关于贪吃蛇' }),
    ).toBeVisible()
    await expect(page.locator('[data-plaza-result-type="collection"]')).toHaveCount(0)
  })
})
