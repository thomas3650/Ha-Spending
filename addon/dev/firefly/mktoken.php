<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$repo = app(FireflyIII\Repositories\User\UserRepositoryInterface::class);
$u = FireflyIII\User::where('email', 'test@example.com')->first()
   ?? $repo->store(['email' => 'test@example.com', 'password' => Illuminate\Support\Str::random(32)]);
$repo->attachRole($u, 'owner');
echo $u->createToken('integration')->accessToken;
