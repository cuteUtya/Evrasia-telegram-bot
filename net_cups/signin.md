**Parameters**
>**URL**  https://evrasia.spb.ru/signin/
>**Method** POST
>**Body content type** application/x-www-form-urlencoded

**Body**
> USER_LOGIN: **STRING**
> USER_PASSWORD: **STRING**
> AUTH_FORM: **STRING/BOOL (Y/N)** 
> TYPE: **??? (AUTH)**
> USER_REMEMBER: **STRING/BOOL (Y/N)**
> backurl: **STRING (/signin/)**

**Responce**
> **Succes**: 303 with cookies BITRIX_SM_UIDH and BITRIX_SM_LOGIN
> **Fail**: 200 with "Неверный логин или пароль" in HTML