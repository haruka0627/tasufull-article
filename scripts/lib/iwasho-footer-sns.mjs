/**
 * IWASHO footer SNS icons — Font Awesome 6 Brands (unified library)
 */
export const FOOTER_SNS_GROUP_HTML = `<div class="sns-group">
        <a href="#" class="sns-link" aria-label="Facebook">
          <i class="fa-brands fa-facebook-f sns-icon" aria-hidden="true"></i>
        </a>
        <a href="#" class="sns-link" aria-label="Instagram">
          <i class="fa-brands fa-instagram sns-icon" aria-hidden="true"></i>
        </a>
        <a href="#" class="sns-link" aria-label="X">
          <i class="fa-brands fa-x-twitter sns-icon" aria-hidden="true"></i>
        </a>
      </div>`;

/** Legacy inline-SVG block (pre–Font Awesome) */
export const LEGACY_SNS_GROUP_PATTERN =
  /<div class="sns-group">[\s\S]*?<\/div>\s*(?=<\/div>\s*<div class="footer-col">|<\/div>\s*<\/div>\s*<div class="footer-col">)/;
