import { test, expect, type Page } from '@playwright/test'

const E2E_NAME = process.env.AUTH_E2E_NAME ?? ''
const E2E_USERNAME = process.env.AUTH_E2E_USERNAME ?? ''
const E2E_PASSWORD = process.env.AUTH_E2E_PASSWORD ?? ''
const HAS_CREDENTIALS = !!(E2E_NAME && E2E_USERNAME && E2E_PASSWORD)

async function login(page: Page, identifier: string) {
  await page.goto('/')
  await expect(page.locator('#auth-name')).toBeVisible({ timeout: 20000 })
  await page.locator('#auth-name').fill(identifier)
  await page.locator('#auth-cred').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page.locator('#auth-name')).toBeHidden({ timeout: 20000 })
}

test.describe('认证登录', () => {
  test('姓名和用户名都能建立可用会话', async ({ browser }) => {
    test.skip(!HAS_CREDENTIALS, '设置 AUTH_E2E_NAME、AUTH_E2E_USERNAME、AUTH_E2E_PASSWORD 后运行')

    for (const identifier of [E2E_NAME, E2E_USERNAME]) {
      const page = await browser.newPage()
      await login(page, identifier)
      await page.reload()
      await expect(page.locator('#auth-name')).toBeHidden({ timeout: 20000 })
      await page.close()
    }
  })

  test('无效本地会话不能绕过登录门', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('wiki_session', JSON.stringify({
        userId: '00000000-0000-0000-0000-000000000000',
        username: 'stale-session',
        studentId: 'stale-session',
        name: 'stale-session',
        role: 'admin',
        loginTime: new Date().toISOString(),
      }))
    })

    await page.goto('/')
    await expect(page.locator('#auth-name')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('#auth-cred')).toBeVisible()
  })

  test('错误密码不会进入已登录页面', async ({ page }) => {
    test.skip(!HAS_CREDENTIALS, '设置 AUTH_E2E_NAME、AUTH_E2E_USERNAME、AUTH_E2E_PASSWORD 后运行')

    await page.goto('/')
    await expect(page.locator('#auth-name')).toBeVisible({ timeout: 20000 })
    await page.locator('#auth-name').fill(E2E_USERNAME)
    await page.locator('#auth-cred').fill(`wrong-${Date.now()}`)
    await page.getByRole('button', { name: /登\s*录/ }).click()
    await expect(page.getByText('姓名/用户名或密码错误，请检查后重试')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('#auth-name')).toBeVisible()
  })
})
