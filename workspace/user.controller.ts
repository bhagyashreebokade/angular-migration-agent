import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  standalone: true,
})
export class UserController implements OnInit {
  users: any[] = [];
  loading = true;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<any[]>('/api/users').subscribe({
      next: (res) => {
        this.users = res;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  remove(id: number) {
    this.http.delete(`/api/users/${id}`).subscribe(() => {
      this.users = this.users.filter((u) => u.id !== id);
    });
  }
}
