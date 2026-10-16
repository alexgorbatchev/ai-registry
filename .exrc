augroup ai_registry_ejs
  autocmd!
  execute 'autocmd BufRead,BufNewFile ' . fnameescape(expand('<sfile>:p:h')) . '/*.md setlocal filetype=ejs'
augroup END
