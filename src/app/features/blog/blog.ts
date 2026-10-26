import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BlogPost } from '../../core/models/blog-post.model';
import { BlogService } from '../../core/services/blog';

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './blog.html',
  styleUrls: ['./blog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlogComponent implements OnInit {
  private readonly blogService = inject(BlogService);

  // Signals: en una app zoneless, solo un signal avisa a Angular que debe repintar.
  readonly featuredPost = signal<BlogPost | undefined>(undefined);
  readonly gridPosts = signal<BlogPost[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  ngOnInit(): void {
    this.loadPosts();
  }

  loadPosts(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.blogService.getPosts().subscribe({
      next: (posts) => {
        const publishedPosts = (posts ?? [])
          .filter(post => post.published === true)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        this.featuredPost.set(publishedPosts[0]);
        this.gridPosts.set(publishedPosts.slice(1));
        this.isLoading.set(false);
      },

      error: (error) => {
        console.error('No se pudieron cargar los artículos del blog:', error);

        this.featuredPost.set(undefined);
        this.gridPosts.set([]);
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  trackByPostId(_index: number, post: BlogPost): string {
    return post.id;
  }
}