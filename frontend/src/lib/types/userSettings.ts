export type ThemeSetting = 'light' | 'dark' | 'system'

export type TablePageSizeSetting = 10 | 25 | 50 | 100

export type UserSettings = {
  theme: ThemeSetting
  receive_emails: boolean
  default_table_page_size: TablePageSizeSetting
}
