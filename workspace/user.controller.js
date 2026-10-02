angular.module('app').controller('UserController', function ($scope, $http) {
  $scope.users = [];
  $scope.loading = true;

  $http.get('/api/users').then(function (res) {
    $scope.users = res.data;
    $scope.loading = false;
  });

  $scope.remove = function (id) {
    $http.delete('/api/users/' + id).then(function () {
      $scope.users = $scope.users.filter(function (u) { return u.id !== id; });
    });
  };
});
